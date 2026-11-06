
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;

    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only return results released by the teacher.
    const results = await prisma.result.findMany({
      where: {
        studentId: payload.id,
        exam: {
          resultsReleased: true,
        },
      },
      include: {
        exam: {
          select: {
            title: true,
            startTime: true,
            durationMinutes: true,
            resultsReleased: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = results.map((r: any) => ({
      id: r.id,
      examId: r.examId,
      examTitle: r.exam.title,
      examDate: r.exam.startTime,
      score: r.score,
      correctAnswers:
        r.correctAnswers ??
        Math.round((r.score / 100) * r.totalQuestions),
      totalQuestions: r.totalQuestions,
      timeSpent: r.timeSpent,
      resultsReleased: r.exam.resultsReleased,
    }));

    return NextResponse.json({ results: formatted });
  } catch (error) {
    console.error("GET student results error:", error);

    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
