import {
    NextRequest,
    NextResponse,
} from "next/server";

import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

const ALLOWED_EVENT_TYPES = new Set([
    "TAB_SWITCH",
    "BLUR",
    "FOCUS",
    "FULLSCREEN_EXIT",
    "EXAM_STARTED",
    "EXAM_SUBMITTED",
]);

export async function POST(
    request: NextRequest
) {
    try {
        // ---------------------------------------------------------------
        // 1. Authenticate student
        // ---------------------------------------------------------------
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
                {
                    status: 401,
                }
            );
        }

        // ---------------------------------------------------------------
        // 2. Read request
        // ---------------------------------------------------------------
        const body = await request.json();

        const {
            examId,
            type,
            timestamp,
            sequenceNumber,
            metadata,
        } = body;

        if (!examId) {
            return NextResponse.json(
                {
                    error: "Exam ID is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !type ||
            !ALLOWED_EVENT_TYPES.has(type)
        ) {
            return NextResponse.json(
                {
                    error:
                        "A valid proctor event type is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !timestamp ||
            Number.isNaN(
                Date.parse(timestamp)
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "A valid event timestamp is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !Number.isInteger(sequenceNumber) ||
            sequenceNumber < 1
        ) {
            return NextResponse.json(
                {
                    error:
                        "A valid sequence number is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const studentId = payload.id;

        // ---------------------------------------------------------------
        // 3. Verify the student's exam session
        // ---------------------------------------------------------------
        const session =
            await prisma.examSession.findUnique({
                where: {
                    examId_studentId: {
                        examId,
                        studentId,
                    },
                },
            });

        if (!session) {
            return NextResponse.json(
                {
                    error: "Exam session not found.",
                },
                {
                    status: 404,
                }
            );
        }

        // ---------------------------------------------------------------
        // 4. Store the event and update the session atomically
        // ---------------------------------------------------------------
        const result =
            await prisma.$transaction(
                async (tx) => {
                    // Check for an already-synchronized event.
                    const existingEvent =
                        await tx.offlineProctorEvent.findUnique(
                            {
                                where: {
                                    examId_studentId_sequenceNumber: {
                                        examId,
                                        studentId,
                                        sequenceNumber,
                                    },
                                },
                            }
                        );

                    if (existingEvent) {
                        return {
                            duplicate: true,
                            tabSwitches:
                                session.tabSwitches,
                            status: session.status,
                        };
                    }

                    // Store the event.
                    await tx.offlineProctorEvent.create({
                        data: {
                            examId,
                            studentId,
                            eventType: type,
                            eventTimestamp:
                                new Date(timestamp),
                            sequenceNumber,
                            metadata:
                                metadata ?? undefined,
                        },
                    });

                    // Only TAB_SWITCH changes the official
                    // tab-switch counter.
                    let tabSwitches =
                        session.tabSwitches;

                    const status =
                        session.status;

                    if (
                        type === "TAB_SWITCH"
                    ) {
                        tabSwitches += 1;
                    }

                    const updatedSession =
                        await tx.examSession.update({
                            where: {
                                id: session.id,
                            },
                            data: {
                                tabSwitches,
                                status,
                                lastPing: new Date(),
                            },
                        });

                    return {
                        duplicate: false,
                        tabSwitches:
                            updatedSession.tabSwitches,
                        status:
                            updatedSession.status,
                    };
                }
            );

        // ---------------------------------------------------------------
        // 5. Return synchronization result
        // ---------------------------------------------------------------
        return NextResponse.json({
            success: true,
            duplicate: result.duplicate,
            tabSwitches:
                result.tabSwitches,
            status:
                result.status,
        });
    } catch (error: any) {
        console.error(
            "Offline proctor event sync error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Internal server error.",
            },
            {
                status: 500,
            }
        );
    }
}