import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questions, subjectId, assessmentType } = await request.json();

    if (!subjectId) {
      return NextResponse.json({ error: "Subject ID is required" }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "No questions provided to import" }, { status: 400 });
    }

    // Save all questions in a transaction
    const createdQuestions = await prisma.$transaction(
      questions.map((q: any) => {
        const [oA, oB, oC, oD, oE, oF] = q.options || [];
        return prisma.question.create({
          data: {
            subjectId,
            teacherId: payload.id,
            questionText: q.questionText,
            optionA: oA || "",
            optionB: oB || "",
            optionC: oC || "",
            optionD: oD || "",
            optionE: oE || null,
            optionF: oF || null,
            correctOption: q.correctOption.toUpperCase(),
            assessmentType: assessmentType || "Exam",
            points: 1,
            status: "PUBLISHED",
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      count: createdQuestions.length,
    });
  } catch (error: any) {
    console.error("DOCX question confirm error:", error);
    return NextResponse.json({ error: error.message || "Failed to import questions" }, { status: 500 });
  }
}
