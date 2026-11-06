import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

export async function DELETE(request: NextRequest) {
    try {
        // Verify teacher authentication
        const token = request.cookies.get("token")?.value;
        const payload = token ? await verifyJWT(token) : null;

        if (!payload || payload.role !== "TEACHER") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get assessment details
        const body = await request.json();
        const { subjectId, assessmentType } = body;

        if (!subjectId || !assessmentType) {
            return NextResponse.json(
                { error: "Subject and assessment type are required." },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            // Find questions owned by this teacher
            const questions = await tx.question.findMany({
                where: {
                    teacherId: payload.id,
                    subjectId,
                    assessmentType,
                },
                select: {
                    id: true,
                },
            });

            if (questions.length === 0) {
                throw new Error("No questions found for this assessment.");
            }

            const questionIds = questions.map((q) => q.id);

            // Prevent deletion if students have attempted any question
            const attempts = await tx.studentAttempt.count({
                where: {
                    questionId: {
                        in: questionIds,
                    },
                },
            });

            if (attempts > 0) {
                throw new Error(
                    `Cannot delete this assessment because ${attempts} student attempt record(s) exist.`
                );
            }

            // Delete all questions belonging to this assessment panel
            const deleted = await tx.question.deleteMany({
                where: {
                    id: {
                        in: questionIds,
                    },
                    teacherId: payload.id,
                },
            });

            return deleted.count;
        });

        return NextResponse.json({
            success: true,
            deletedCount: result,
            message: "Assessment deleted successfully.",
        });
    } catch (error: any) {
        console.error("DELETE assessment panel error:", error);

        return NextResponse.json(
            {
                error:
                    error.message || "Failed to delete assessment.",
            },
            { status: 500 }
        );
    }
}
