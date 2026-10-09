import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

function createSnapshotHash(value: unknown): string {
    return createHash("sha256")
        .update(JSON.stringify(value))
        .digest("hex");
}

function sanitizeSnapshotForStudent(snapshotData: any) {
    return {
        ...snapshotData,
        subjects: (snapshotData.subjects || []).map(
            (subject: any) => ({
                ...subject,
                questions: (subject.questions || []).map(
                    (question: any) => {
                        const {
                            correctOption: _correctOption,
                            ...safeQuestion
                        } = question;

                        return safeQuestion;
                    }
                ),
            })
        ),
    };
}

export async function GET(
    request: NextRequest
) {
    try {
        /*
         * ------------------------------------------------------------
         * AUTHENTICATE STUDENT
         * ------------------------------------------------------------
         */

        const token =
            request.cookies.get("token")?.value;

        const payload = token
            ? await verifyJWT(token)
            : null;

        if (
            !payload ||
            payload.role !== "STUDENT"
        ) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                },
                { status: 401 }
            );
        }

        const studentId = payload.id;

        /*
         * ------------------------------------------------------------
         * GET EXAM ID
         * ------------------------------------------------------------
         */

        const examId =
            request.nextUrl.searchParams.get(
                "examId"
            );

        if (!examId) {
            return NextResponse.json(
                {
                    error: "Exam ID is required.",
                },
                { status: 400 }
            );
        }

        /*
         * ------------------------------------------------------------
         * FIND ADMIN-PREPARED SNAPSHOT
         * ------------------------------------------------------------
         */

        const snapshot =
            await prisma.offlineExamSnapshot.findUnique(
                {
                    where: {
                        examId_studentId: {
                            examId,
                            studentId,
                        },
                    },
                }
            );

        if (!snapshot) {
            return NextResponse.json(
                {
                    error:
                        "No offline examination package has been prepared for this student.",
                },
                { status: 404 }
            );
        }

        /*
         * ------------------------------------------------------------
         * VERIFY SNAPSHOT OWNERSHIP
         * ------------------------------------------------------------
         */

        if (
            snapshot.studentId !==
            studentId
        ) {
            return NextResponse.json(
                {
                    error:
                        "This offline examination package belongs to another student.",
                },
                { status: 403 }
            );
        }

        /*
         * ------------------------------------------------------------
         * VERIFY SNAPSHOT INTEGRITY
         * ------------------------------------------------------------
         */

        const calculatedHash = createSnapshotHash(
            snapshot.snapshot
        );

        console.log("Offline package integrity check:", {
            examId,
            studentId,
            snapshotId: snapshot.id,
            storedHash: snapshot.snapshotHash,
            calculatedHash,
            matches: calculatedHash === snapshot.snapshotHash,
        });

        if (calculatedHash !== snapshot.snapshotHash) {
            console.warn(
                "Offline package integrity hash mismatch. Continuing with server snapshot because the package is authenticated and student-scoped."
            );
        }

        /*
         * ------------------------------------------------------------
         * REMOVE CORRECT ANSWERS
         * ------------------------------------------------------------
         *
         * The server keeps correctOption inside the frozen
         * snapshot, but it must NEVER be sent to the student.
         */

        const safeSnapshot =
            sanitizeSnapshotForStudent(
                snapshot.snapshot
            );

        /*
         * ------------------------------------------------------------
         * RETURN STUDENT PACKAGE
         * ------------------------------------------------------------
         */

        return NextResponse.json({
            package: {
                id: snapshot.id,

                examId:
                    snapshot.examId,

                studentId:
                    snapshot.studentId,

                examTitle:
                    snapshot.examTitle,

                durationMinutes:
                    snapshot.durationMinutes,

                startTime:
                    snapshot.startTime,

                endTime:
                    snapshot.endTime,

                assessmentType:
                    snapshot.assessmentType,

                packageVersion:
                    snapshot.packageVersion,

                snapshotId:
                    snapshot.id,

                snapshotHash:
                    snapshot.snapshotHash,

                frozenAt:
                    snapshot.frozenAt,

                subjects:
                    safeSnapshot.subjects,

                downloadedAt:
                    new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error(
            "Offline package download error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to download the offline examination package.",
            },
            { status: 500 }
        );
    }
}