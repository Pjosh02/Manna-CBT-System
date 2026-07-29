import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { examId, timeSpent } = await request.json();

    if (!examId || timeSpent === undefined) {
      return NextResponse.json({ error: "Exam ID and time spent are required" }, { status: 400 });
    }

    const studentId = payload.id;

    // Check if result already exists
    const existingResult = await prisma.result.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (existingResult) {
      return NextResponse.json({ error: "Exam already submitted" }, { status: 400 });
    }

    // 1. Fetch exam and associated subjects
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examSubjects: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // 2. Re-compile the exact questions assigned to the student
    let totalQuestionsCount = 0;
    let correctAnswersCount = 0;

    // Fetch student's attempts for this exam
    const attempts = await prisma.studentAttempt.findMany({
      where: {
        examId,
        studentId,
      },
    });

    const attemptsMap = attempts.reduce((acc: any, att) => {
      acc[att.questionId] = att.selectedOption;
      return acc;
    }, {});

    for (const es of exam.examSubjects) {
      const allSubjectQuestions = await prisma.question.findMany({
        where: {
          subjectId: es.subjectId,
          status: "PUBLISHED",
        },
      });

      // Same deterministic shuffle
      const shuffled = allSubjectQuestions
        .map((q) => ({
          q,
          hash: hashString(studentId + q.id),
        }))
        .sort((a, b) => a.hash - b.hash)
        .map((item) => item.q);

      const assignedQuestions = shuffled.slice(0, es.numberOfQuestions);
      totalQuestionsCount += assignedQuestions.length;

      // Grade attempts
      assignedQuestions.forEach((q) => {
        const studentSelect = attemptsMap[q.id];
        if (studentSelect && studentSelect.toUpperCase() === q.correctOption.toUpperCase()) {
          correctAnswersCount += 1;
        }
      });
    }

    if (totalQuestionsCount === 0) {
      return NextResponse.json({ error: "This exam has no questions configured." }, { status: 400 });
    }

    // Calculate score percentage (e.g. 80.0%)
    const score = Math.round((correctAnswersCount / totalQuestionsCount) * 10000) / 100;

    // 3. Create Result record
    const result = await prisma.result.create({
      data: {
        examId,
        studentId,
        score,
        totalQuestions: totalQuestionsCount,
        timeSpent: parseInt(timeSpent, 10),
      },
      include: {
        exam: true,
      },
    });

    // Update ExamSession status to SUBMITTED
    await prisma.examSession.upsert({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
      update: {
        status: "SUBMITTED",
        lastPing: new Date(),
      },
      create: {
        examId,
        studentId,
        status: "SUBMITTED",
      },
    });

    return NextResponse.json({
      success: true,
      result: {
        id: result.id,
        examTitle: result.exam.title,
        score: result.score,
        totalQuestions: result.totalQuestions,
        correctAnswers: correctAnswersCount,
        timeSpent: result.timeSpent,
      },
    });
  } catch (error) {
    console.error("POST student test submit error:", error);
    return NextResponse.json({ error: "Failed to submit exam" }, { status: 500 });
  }
}
