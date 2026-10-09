import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import {
    calculateExamSubmission,
    persistExamSubmission,
} from "@/lib/student/submit-exam";

type SubmissionTestResult = Awaited<
    ReturnType<typeof persistExamSubmission>
>;

class OfflineSubmissionRollback extends Error {
    constructor(public readonly result: SubmissionTestResult) {
        super("__OFFLINE_SUBMISSION_TEST_ROLLBACK__");
        this.name = "OfflineSubmissionRollback";
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get("token")?.value;
        const payload = token ? await verifyJWT(token) : null;

        if (!payload || payload.role !== "STUDENT") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { examId, timeSpent } = await request.json();

        if (!examId || timeSpent === undefined) {
            return NextResponse.json(
                {
                    error: "Exam ID and time spent are required",
                },
                { status: 400 }
            );
        }

        const studentId = payload.id;

        /*
         * IMPORTANT:
         * This transaction intentionally throws after the complete
         * submission pipeline has executed.
         *
         * That forces Prisma to ROLLBACK every database change.
         *
         * Therefore this endpoint can test the complete offline
         * submission pipeline without creating a real Result,
         * SubjectScore, User score update, or submitted ExamSession.
         */
        try {
            await prisma.$transaction(
                async (tx) => {
                    const submission = await calculateExamSubmission(
                        tx,
                        examId,
                        studentId
                    );

                    const result = await persistExamSubmission(
                        tx,
                        {
                            examId,
                            studentId,
                            timeSpent: parseInt(timeSpent, 10),
                            submission,
                        }
                    );

                    throw new OfflineSubmissionRollback(result);
                },
                {
                    maxWait: 10000,
                    timeout: 30000,
                }
            );
        } catch (error) {
            if (error instanceof OfflineSubmissionRollback) {
                return NextResponse.json({
                    success: true,
                    testOnly: true,
                    rolledBack: true,
                    message:
                        "Offline submission pipeline executed successfully and was rolled back safely.",
                    result: {
                        examTitle: error.result.examTitle,
                        score: error.result.score,
                        totalQuestions: error.result.totalQuestions,
                        correctAnswers: error.result.correctAnswers,
                        timeSpent: error.result.timeSpent,
                    },
                });
            }

            throw error;
        }
    } catch (error) {
        console.error(
            "POST offline submission test error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to test offline submission";

        if (message === "Exam already submitted") {
            return NextResponse.json(
                { error: message },
                { status: 400 }
            );
        }

        if (message === "Exam not found") {
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
                error: "Failed to test offline submission",
                details: message,
            },
            { status: 500 }
        );
    }
}