import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");

    const questions = await prisma.question.findMany({
      where: {
        teacherId: payload.id,
        subjectId: subjectId || undefined,
      },
      include: {
        subject: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("GET teacher questions error:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Check if it's bulk upload (array of questions)
    if (Array.isArray(body)) {
      const addedQuestions = [];
      const errors = [];

      for (const row of body) {
        const {
          subjectId,
          questionText,
          imageUrl,
          passageText,
          passageTitle,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          assessmentType,
          points,
          status,
        } = row;

        if (!subjectId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctOption) {
          errors.push(`Missing fields for question: ${questionText?.substring(0, 20) || "unknown"}`);
          continue;
        }

        const validOptions = ["A", "B", "C", "D"];
        if (!validOptions.includes(correctOption.toString().toUpperCase())) {
          errors.push(`Invalid correct option "${correctOption}" for question: ${questionText?.substring(0, 20)}`);
          continue;
        }

        const subjectExists = await prisma.subject.findUnique({
          where: { id: subjectId },
        });
        if (!subjectExists) {
          errors.push(`Invalid subject ID "${subjectId}" for question: ${questionText?.substring(0, 20)}`);
          continue;
        }

        const question = await prisma.question.create({
          data: {
            subjectId,
            teacherId: payload.id,
            questionText,
            imageUrl: imageUrl || null,
            passageText: passageText || null,
            passageTitle: passageTitle || null,
            optionA: optionA.toString(),
            optionB: optionB.toString(),
            optionC: optionC.toString(),
            optionD: optionD.toString(),
            correctOption: correctOption.toString().toUpperCase(),
            assessmentType: assessmentType || "Exam",
            points: points ? parseInt(points.toString()) : 1,
            status: status || "PUBLISHED",
          },
        });
        addedQuestions.push(question);
      }

      return NextResponse.json({
        success: true,
        count: addedQuestions.length,
        questions: addedQuestions,
        errors,
      });
    }

    // Single question upload
    const {
      subjectId,
      questionText,
      imageUrl,
      passageText,
      passageTitle,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      assessmentType,
      points,
      status,
    } = body;

    if (!subjectId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctOption) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validOptions = ["A", "B", "C", "D"];
    if (!validOptions.includes(correctOption.toUpperCase())) {
      return NextResponse.json({ error: "Correct option must be A, B, C, or D" }, { status: 400 });
    }

    const subjectExists = await prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subjectExists) {
      return NextResponse.json({ error: "Invalid subject ID. Please select a valid subject." }, { status: 400 });
    }

    const newQuestion = await prisma.question.create({
      data: {
        subjectId,
        teacherId: payload.id,
        questionText,
        imageUrl: imageUrl || null,
        passageText: passageText || null,
        passageTitle: passageTitle || null,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: correctOption.toUpperCase(),
        assessmentType: assessmentType || "Exam",
        points: points ? parseInt(points.toString()) : 1,
        status: status || "PUBLISHED",
      },
    });

    return NextResponse.json({ question: newQuestion }, { status: 201 });
  } catch (error) {
    console.error("POST question error:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      id,
      subjectId,
      questionText,
      imageUrl,
      passageText,
      passageTitle,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      assessmentType,
      points,
      status,
    } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    // Verify ownership
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question || question.teacherId !== payload.id) {
      return NextResponse.json({ error: "Question not found or unauthorized" }, { status: 404 });
    }

    if (correctOption) {
      const validOptions = ["A", "B", "C", "D"];
      if (!validOptions.includes(correctOption.toUpperCase())) {
        return NextResponse.json({ error: "Correct option must be A, B, C, or D" }, { status: 400 });
      }
    }

    if (subjectId !== undefined) {
      if (!subjectId) {
        return NextResponse.json({ error: "Subject ID is required" }, { status: 400 });
      }
      const subjectExists = await prisma.subject.findUnique({
        where: { id: subjectId },
      });
      if (!subjectExists) {
        return NextResponse.json({ error: "Invalid subject ID. Please select a valid subject." }, { status: 400 });
      }
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        subjectId,
        questionText,
        imageUrl,
        passageText,
        passageTitle,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: correctOption ? correctOption.toUpperCase() : undefined,
        assessmentType: assessmentType !== undefined ? assessmentType : undefined,
        points: points !== undefined ? parseInt(points.toString()) : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    return NextResponse.json({ question: updated });
  } catch (error) {
    console.error("PATCH question error:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    // Verify ownership
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question || question.teacherId !== payload.id) {
      return NextResponse.json({ error: "Question not found or unauthorized" }, { status: 404 });
    }

    await prisma.question.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE question error:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
