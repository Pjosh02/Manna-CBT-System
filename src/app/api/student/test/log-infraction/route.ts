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

    const { examId } = await request.json();
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 });
    }

    const studentId = payload.id;

    const session = await prisma.examSession.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status === "SUBMITTED") {
      return NextResponse.json({ success: true, status: "SUBMITTED", tabSwitches: session.tabSwitches });
    }

    const newTabSwitches = session.tabSwitches + 1;
    let newStatus = session.status;

    if (newTabSwitches >= 3) {
      newStatus = "SUBMITTED";

      // Perform Auto-Submission grading
      const existingResult = await prisma.result.findUnique({
        where: {
          examId_studentId: {
            examId,
            studentId,
          },
        },
      });

      if (!existingResult) {
        // Fetch exam and associated subjects
        const exam = await prisma.exam.findUnique({
          where: { id: examId },
          include: {
            examSubjects: true,
          },
        });

        if (exam) {
          let totalQuestionsCount = 0;
          let correctAnswersCount = 0;
          let firstAssignedQuestionType: string | null = null;

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

            // Deterministic shuffle
            const shuffled = allSubjectQuestions
              .map((q) => ({
                q,
                hash: hashString(studentId + q.id),
              }))
              .sort((a, b) => a.hash - b.hash)
              .map((item) => item.q);

            const assignedQuestions = shuffled.slice(0, es.numberOfQuestions);
            totalQuestionsCount += assignedQuestions.length;

            if (assignedQuestions.length > 0 && !firstAssignedQuestionType) {
              firstAssignedQuestionType = assignedQuestions[0].assessmentType;
            }

            assignedQuestions.forEach((q) => {
              const studentSelect = attemptsMap[q.id];
              if (studentSelect && studentSelect.toUpperCase() === q.correctOption.toUpperCase()) {
                correctAnswersCount += 1;
              }
            });
          }

          if (totalQuestionsCount > 0) {
            const score = Math.round((correctAnswersCount / totalQuestionsCount) * 10000) / 100;
            // Create Result record
            await prisma.result.create({
              data: {
                examId,
                studentId,
                score,
                correctAnswers: correctAnswersCount,
                totalQuestions: totalQuestionsCount,
                timeSpent: 1, // Placeholder for auto-submission timespent
              },
            });

            // Automatically persist score to student record (CA / Exam Score)
            let assessmentType = "Exam";
            if (firstAssignedQuestionType === "1st CA" || firstAssignedQuestionType === "2nd CA" || firstAssignedQuestionType === "Exam") {
              assessmentType = firstAssignedQuestionType;
            } else {
              const titleLower = exam.title.toLowerCase();
              if (titleLower.includes("1st ca") || titleLower.includes("first ca")) {
                assessmentType = "1st CA";
              } else if (titleLower.includes("2nd ca") || titleLower.includes("second ca")) {
                assessmentType = "2nd CA";
              }
            }

            let caField: "firstCA" | "secondCA" | "examScore" | null = null;
            let maxScore = 100;
            if (assessmentType === "1st CA") {
              caField = "firstCA";
              maxScore = 20;
            } else if (assessmentType === "2nd CA") {
              caField = "secondCA";
              maxScore = 20;
            } else {
              caField = "examScore";
              maxScore = 60;
            }

            if (caField && totalQuestionsCount > 0) {
              const scaledScore = Math.round((correctAnswersCount / totalQuestionsCount) * maxScore * 100) / 100;
              await prisma.user.update({
                where: { id: studentId },
                data: {
                  [caField]: scaledScore,
                },
              });
            }
          }
        }
      }
    }

    // Update ExamSession
    const updatedSession = await prisma.examSession.update({
      where: { id: session.id },
      data: {
        tabSwitches: newTabSwitches,
        status: newStatus,
        lastPing: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      status: updatedSession.status,
      tabSwitches: updatedSession.tabSwitches,
    });
  } catch (error: any) {
    console.error("Student log infraction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
