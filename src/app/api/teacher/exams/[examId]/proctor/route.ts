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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { examId } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examSubjects: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    // Fetch all students in the exam's class
    const students = await prisma.user.findMany({
      where: {
        classId: exam.classId,
        role: "STUDENT",
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    // Fetch all sessions for this exam
    const sessions = await prisma.examSession.findMany({
      where: { examId },
    });

    // Fetch all results for this exam
    const results = await prisma.result.findMany({
      where: { examId },
    });

    const sessionsMap = sessions.reduce((acc: any, s) => {
      acc[s.studentId] = s;
      return acc;
    }, {});

    const resultsMap = results.reduce((acc: any, r) => {
      acc[r.studentId] = r;
      return acc;
    }, {});

    const proctorList = students.map((student) => {
      const session = sessionsMap[student.id];
      const result = resultsMap[student.id];

      let liveStatus = "NOT_STARTED";
      let tabSwitches = 0;
      let ipAddress = null;
      let userAgent = null;
      let lastActive = null;

      if (session) {
        tabSwitches = session.tabSwitches;
        ipAddress = session.ipAddress;
        userAgent = session.userAgent;
        lastActive = session.lastPing;

        if (session.status === "SUBMITTED" || result) {
          liveStatus = "SUBMITTED";
        } else {
          // Check if pinged within the last 30 seconds
          const isOnline = Date.now() - new Date(session.lastPing).getTime() < 30000;
          liveStatus = isOnline ? "ONLINE" : "OFFLINE";
        }
      }

      return {
        studentId: student.id,
        name: student.name,
        rollNumber: student.rollNumber || student.email || "N/A",
        status: liveStatus,
        tabSwitches,
        ipAddress,
        userAgent,
        lastActive,
        score: result ? result.score : null,
        totalQuestions: result ? result.totalQuestions : null,
      };
    });

    return NextResponse.json({
      examTitle: exam.title,
      durationMinutes: exam.durationMinutes,
      students: proctorList,
    });
  } catch (error: any) {
    console.error("GET proctor error:", error);
    return NextResponse.json({ error: "Failed to load proctor list" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { examId } = await params;
    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    // Force submit student session
    let session = await prisma.examSession.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (!session) {
      // Create session as submitted if not started
      session = await prisma.examSession.create({
        data: {
          examId,
          studentId,
          status: "SUBMITTED",
        },
      });
    } else {
      session = await prisma.examSession.update({
        where: { id: session.id },
        data: {
          status: "SUBMITTED",
          lastPing: new Date(),
        },
      });
    }

    // Check if result already exists
    const existingResult = await prisma.result.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (!existingResult) {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: { examSubjects: true },
      });

      if (exam) {
        let totalQuestionsCount = 0;
        let correctAnswersCount = 0;

        const attempts = await prisma.studentAttempt.findMany({
          where: { examId, studentId },
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

          const shuffled = allSubjectQuestions
            .map((q) => ({
              q,
              hash: hashString(studentId + q.id),
            }))
            .sort((a, b) => a.hash - b.hash)
            .map((item) => item.q);

          const assignedQuestions = shuffled.slice(0, es.numberOfQuestions);
          totalQuestionsCount += assignedQuestions.length;

          assignedQuestions.forEach((q) => {
            const studentSelect = attemptsMap[q.id];
            if (studentSelect && studentSelect.toUpperCase() === q.correctOption.toUpperCase()) {
              correctAnswersCount += 1;
            }
          });
        }

        if (totalQuestionsCount > 0) {
          const score = Math.round((correctAnswersCount / totalQuestionsCount) * 10000) / 100;
          await prisma.result.create({
            data: {
              examId,
              studentId,
              score,
              correctAnswers: correctAnswersCount,
              totalQuestions: totalQuestionsCount,
              timeSpent: 0,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Force submit error:", error);
    return NextResponse.json({ error: "Failed to force submit exam" }, { status: 500 });
  }
}
