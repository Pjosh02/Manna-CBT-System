import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

// Simple hash function for deterministic sorting
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId");

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    // 1. Fetch the exam details and associated subjects
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (exam.status !== "LIVE") {
      return NextResponse.json({ error: "This exam is currently closed." }, { status: 403 });
    }

    // Check if the student already submitted this exam
    const existingResult = await prisma.result.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: payload.id,
        },
      },
    });

    if (existingResult) {
      return NextResponse.json({ error: "You have already submitted this exam." }, { status: 400 });
    }

    // Check and update/create ExamSession
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    let session = await prisma.examSession.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId: payload.id,
        },
      },
    });

    if (session && session.status === "SUBMITTED") {
      return NextResponse.json({ error: "You have already submitted this exam." }, { status: 400 });
    }

    if (!session) {
      session = await prisma.examSession.create({
        data: {
          examId,
          studentId: payload.id,
          ipAddress,
          userAgent,
          status: "IN_PROGRESS",
        },
      });
    } else {
      session = await prisma.examSession.update({
        where: { id: session.id },
        data: {
          status: "IN_PROGRESS",
          lastPing: new Date(),
          ipAddress,
          userAgent,
        },
      });
    }

    // 2. Fetch all questions for each subject in this exam
    const subjectsData = [];

    for (const es of exam.examSubjects) {
      // Fetch all questions for this subject
      const allSubjectQuestions = await prisma.question.findMany({
        where: {
          subjectId: es.subjectId,
          status: "PUBLISHED",
          assessmentType: exam.assessmentType || "Exam",
        },
      });

      // Shuffling questions deterministically per student
      const studentId = payload.id;
      const shuffled = allSubjectQuestions
        .map((q) => ({
          q,
          hash: hashString(studentId + q.id),
        }))
        .sort((a, b) => a.hash - b.hash)
        .map((item) => item.q);

      // Slice the required number of questions
      const selectedQuestions = shuffled.slice(0, es.numberOfQuestions);
      selectedQuestions.sort((a, b) => {
        if (a.questionType === "THEORY" && b.questionType !== "THEORY") return 1;
        if (a.questionType !== "THEORY" && b.questionType === "THEORY") return -1;
        return 0;
      });

      subjectsData.push({
        subjectId: es.subjectId,
        subjectName: es.subject.name,
        questions: selectedQuestions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          imageUrl: q.imageUrl,
          passageText: q.passageText,
          passageTitle: q.passageTitle,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          optionE: q.optionE,
          optionF: q.optionF,
          questionType: q.questionType,
        })),
      });
    }

    // 3. Fetch existing attempts to restore state
    const attempts = await prisma.studentAttempt.findMany({
      where: {
        examId,
        studentId: payload.id,
      },
    });

    const attemptsMap = attempts.reduce((acc: any, att) => {
      acc[att.questionId] = {
        selectedOption: att.selectedOption,
        isFlagged: att.isFlagged,
      };
      return acc;
    }, {});

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime,
        endTime: exam.endTime,
      },
      subjects: subjectsData,
      attempts: attemptsMap,
      tabSwitches: session.tabSwitches,
      sessionStatus: session.status,
      studentId: payload.id,
    });
  } catch (error) {
    console.error("GET student test error:", error);
    return NextResponse.json({ error: "Failed to load test session" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { examId, subjectId, questionId, selectedOption, isFlagged } = await request.json();

    if (!examId || !subjectId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Upsert student attempt
    const attempt = await prisma.studentAttempt.upsert({
      where: {
        examId_studentId_questionId: {
          examId,
          studentId: payload.id,
          questionId,
        },
      },
      update: {
        selectedOption: selectedOption || null,
        isFlagged: isFlagged !== undefined ? isFlagged : false,
        answeredAt: new Date(),
      },
      create: {
        examId,
        studentId: payload.id,
        subjectId,
        questionId,
        selectedOption: selectedOption || null,
        isFlagged: isFlagged !== undefined ? isFlagged : false,
      },
    });

    return NextResponse.json({ success: true, attempt });
  } catch (error) {
    console.error("POST student attempt error:", error);
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 });
  }
}
