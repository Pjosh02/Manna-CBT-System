import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import {
  calculateExamSubmission,
  persistExamSubmission,
} from "@/lib/student/submit-exam";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const payload = token
      ? await verifyJWT(token)
      : null;

    if (
      !payload ||
      payload.role !== "STUDENT"
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      examId,
      timeSpent,
    } = await request.json();

    if (
      !examId ||
      timeSpent === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Exam ID and time spent are required",
        },
        { status: 400 }
      );
    }

    const studentId = payload.id;

    // Calculate the submission using the
    // exact same grading logic used by
    // the offline submission test.
    const submission =
      await calculateExamSubmission(
        prisma,
        examId,
        studentId
      );

    // Persist the real submission.
    const result =
      await persistExamSubmission(
        prisma,
        {
          examId,
          studentId,
          timeSpent: parseInt(
            timeSpent,
            10
          ),
          submission,
        }
      );

    return NextResponse.json({
      success: true,
      result: {
        id: result.result.id,
        examTitle:
          result.examTitle,
        score:
          result.score,
        totalQuestions:
          result.totalQuestions,
        correctAnswers:
          result.correctAnswers,
        timeSpent:
          result.timeSpent,
      },
    });
  } catch (error) {
    console.error(
      "POST student test submit error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit exam";

    if (
      message ===
      "Exam already submitted"
    ) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    if (
      message === "Exam not found"
    ) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    if (
      message ===
      "This exam has no questions configured."
    ) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Failed to submit exam",
      },
      { status: 500 }
    );
  }
}