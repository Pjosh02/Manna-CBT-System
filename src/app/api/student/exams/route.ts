import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const classId = payload.classId;
    if (!classId) {
      return NextResponse.json({ exams: [] });
    }

    // Fetch exams assigned to the student's class
    const exams = await prisma.exam.findMany({
      where: {
        classId: classId,
        status: { in: ["LIVE", "CLOSED", "SCHEDULED"] },
      },
      include: {
        class: true,
        examSubjects: {
          include: {
            subject: true,
          },
        },
        results: {
          where: {
            studentId: payload.id,
          },
        },
      },
      orderBy: { startTime: "desc" },
    });

    // Formulate active vs completed exams
    const formattedExams = exams.map((exam: any) => {
      const hasTaken = exam.results.length > 0;
      const result = hasTaken ? exam.results[0] : null;

      // Status check
      const now = new Date();
      const startTime = new Date(exam.startTime);
      const endTime = new Date(exam.endTime);

      let timingStatus = "CLOSED";
      if (exam.status === "LIVE") {
        timingStatus = "LIVE";
      }

      return {
        id: exam.id,
        title: exam.title,
        startTime: exam.startTime,
        endTime: exam.endTime,
        durationMinutes: exam.durationMinutes,
        timingStatus,
        hasTaken,
        resultsReleased: exam.resultsReleased,
        score: exam.resultsReleased && result ? result.score : null,
        correctAnswers: exam.resultsReleased && result ? (result.correctAnswers ?? Math.round((result.score / 100) * result.totalQuestions)) : null,
        totalQuestions: exam.resultsReleased && result ? result.totalQuestions : null,
        timeSpent: exam.resultsReleased && result ? result.timeSpent : null,
        examSubjects: exam.examSubjects.map((es: any) => ({
          subjectId: es.subjectId,
          subjectName: es.subject.name,
          numberOfQuestions: es.numberOfQuestions,
        })),
      };
    });

    return NextResponse.json({ exams: formattedExams });
  } catch (error) {
    console.error("GET student exams error:", error);
    return NextResponse.json({ error: "Failed to fetch student exams" }, { status: 500 });
  }
}
