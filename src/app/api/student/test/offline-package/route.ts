import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

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

function sanitizeSnapshotForStudent(snapshotData: any) {
    return {
        ...snapshotData,
        subjects: (snapshotData.subjects || []).map((subject: any) => ({
            ...subject,
            questions: (subject.questions || []).map((question: any) => {
                const {
                    correctOption: _correctOption,
                    ...safeQuestion
                } = question;

                return safeQuestion;
            }),
        })),
    };
}

function createSnapshotHash(value: unknown): string {
    return createHash("sha256")
        .update(JSON.stringify(value))
        .digest("hex");
}

function buildAssignedQuestions(
    questions: any[],
    studentId: string,
    numberOfQuestions: number
) {
    const shuffled = questions
        .map((q: any) => ({
            q,
            hash: hashString(studentId + q.id),
        }))
        .sort((a: any, b: any) => a.hash - b.hash)
        .map((item: any) => item.q);

    const assignedQuestions = shuffled.slice(
        0,
        numberOfQuestions
    );

    assignedQuestions.sort((a: any, b: any) => {
        if (
            a.questionType === "THEORY" &&
            b.questionType !== "THEORY"
        ) {
            return 1;
        }

        if (
            a.questionType !== "THEORY" &&
            b.questionType === "THEORY"
        ) {
            return -1;
        }

        return 0;
    });

    return assignedQuestions;
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

        const studentId = payload.id;

        const body = await request.json();
        const examId = body?.examId;

        if (!examId) {
            return NextResponse.json(
                { error: "Exam ID is required." },
                { status: 400 }
            );
        }

        const exam = await prisma.exam.findUnique({
            where: {
                id: examId,
            },
            include: {
                examSubjects: {
                    include: {
                        subject: true,
                    },
                },
            },
        });

        if (!exam) {
            return NextResponse.json(
                { error: "Exam not found." },
                { status: 404 }
            );
        }

        if (exam.status !== "LIVE") {
            return NextResponse.json(
                {
                    error:
                        "This exam is not currently available for offline preparation.",
                },
                { status: 400 }
            );
        }

        const student = await prisma.user.findUnique({
            where: {
                id: studentId,
            },
            select: {
                id: true,
                classId: true,
                role: true,
            },
        });

        if (!student || student.role !== "STUDENT") {
            return NextResponse.json(
                { error: "Student account not found." },
                { status: 404 }
            );
        }

        if (student.classId !== exam.classId) {
            return NextResponse.json(
                {
                    error:
                        "You are not assigned to this examination.",
                },
                { status: 403 }
            );
        }

        const existingResult = await prisma.result.findUnique({
            where: {
                examId_studentId: {
                    examId,
                    studentId,
                },
            },
        });

        if (existingResult) {
            return NextResponse.json(
                {
                    error:
                        "You have already completed this examination.",
                },
                { status: 409 }
            );
        }

        /*
         * IMPORTANT:
         * If a snapshot already exists, never rebuild it.
         *
         * This is what protects the student's exact paper from
         * later question-bank changes.
         */
        const existingSnapshot =
            await prisma.offlineExamSnapshot.findUnique({
                where: {
                    examId_studentId: {
                        examId,
                        studentId,
                    },
                },
            });

        if (existingSnapshot) {
            const storedSnapshot =
                existingSnapshot.snapshot as any;
            // Ensure a server-side exam session exists for
            // offline proctor events and later synchronization.
            await prisma.examSession.upsert({
                where: {
                    examId_studentId: {
                        examId,
                        studentId,
                    },
                },
                update: {
                    lastPing: new Date(),
                },
                create: {
                    examId,
                    studentId,
                    status: "IN_PROGRESS",
                    lastPing: new Date(),
                },
            });

            const safeSnapshot = {
                ...storedSnapshot,
                subjects: (storedSnapshot.subjects || []).map(
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

            return NextResponse.json({
                success: true,
                existing: true,
                snapshotId: existingSnapshot.id,
                packageVersion:
                    existingSnapshot.packageVersion,
                examTitle: existingSnapshot.examTitle,
                durationMinutes:
                    existingSnapshot.durationMinutes,
                startTime:
                    existingSnapshot.startTime.toISOString(),
                endTime:
                    existingSnapshot.endTime.toISOString(),
                assessmentType:
                    existingSnapshot.assessmentType,
                frozenAt:
                    existingSnapshot.frozenAt.toISOString(),
                subjects:
                    safeSnapshot.subjects || [],
            });
        }


        const subjects = [];

        for (const examSubject of exam.examSubjects) {
            const allQuestions =
                await prisma.question.findMany({
                    where: {
                        subjectId: examSubject.subjectId,
                        status: "PUBLISHED",
                        assessmentType:
                            exam.assessmentType || "Exam",
                    },
                });

            const assignedQuestions =
                buildAssignedQuestions(
                    allQuestions,
                    studentId,
                    examSubject.numberOfQuestions
                );

            if (
                assignedQuestions.length <
                examSubject.numberOfQuestions
            ) {
                return NextResponse.json(
                    {
                        error: `Not enough published questions are available for ${examSubject.subject.name}. Required: ${examSubject.numberOfQuestions}, available: ${assignedQuestions.length}.`,
                    },
                    { status: 400 }
                );
            }

            const snapshotQuestions =
                assignedQuestions.map(
                    (question: any, index: number) => ({
                        id: question.id,
                        subjectId: question.subjectId,

                        questionText:
                            question.questionText,

                        imageUrl:
                            question.imageUrl ?? null,

                        passageText:
                            question.passageText ?? null,

                        passageTitle:
                            question.passageTitle ?? null,

                        optionA:
                            question.optionA,

                        optionB:
                            question.optionB,

                        optionC:
                            question.optionC,

                        optionD:
                            question.optionD,

                        optionE:
                            question.optionE ?? null,

                        optionF:
                            question.optionF ?? null,

                        questionType:
                            question.questionType,

                        instruction:
                            question.instruction ?? null,

                        points:
                            question.points ?? 1,

                        sequenceNumber:
                            index + 1,

                        assessmentType:
                            question.assessmentType ||
                            exam.assessmentType ||
                            "Exam",

                        /*
                         * SERVER-SIDE ONLY.
                         *
                         * This field is removed before the response
                         * is sent to the student's browser.
                         */
                        correctOption:
                            question.correctOption,
                    })
                );

            subjects.push({
                subjectId: examSubject.subjectId,
                subjectName: examSubject.subject.name,
                numberOfQuestions:
                    examSubject.numberOfQuestions,
                questions: snapshotQuestions,
            });
        }

        const snapshotData = {
            examId,
            studentId,
            subjects,
        };

        const snapshotHash =
            createSnapshotHash(snapshotData);

        const snapshot =
            await prisma.offlineExamSnapshot.create({
                data: {
                    examId,
                    studentId,

                    packageVersion: 1,

                    examTitle: exam.title,

                    durationMinutes:
                        exam.durationMinutes,

                    startTime: exam.startTime,

                    endTime: exam.endTime,

                    assessmentType:
                        exam.assessmentType || "Exam",

                    snapshotHash,

                    snapshot: snapshotData,
                },
            });

        // Ensure a server-side exam session exists for
        // offline proctor events and later synchronization.
        await prisma.examSession.upsert({
            where: {
                examId_studentId: {
                    examId,
                    studentId,
                },
            },
            update: {
                lastPing: new Date(),
            },
            create: {
                examId,
                studentId,
                status: "IN_PROGRESS",
                lastPing: new Date(),
            },
        });

        /*
         * Remove correct answers before sending anything
         * to the browser.
         */
        const clientSubjects =
            subjects.map((subject: any) => ({
                subjectId: subject.subjectId,
                subjectName: subject.subjectName,
                numberOfQuestions:
                    subject.numberOfQuestions,

                questions: subject.questions.map(
                    (question: any) => {
                        const {
                            correctOption: _correctOption,
                            ...safeQuestion
                        } = question;

                        return safeQuestion;
                    }
                ),
            }));

        return NextResponse.json({
            success: true,
            existing: false,

            snapshotId: snapshot.id,

            packageVersion:
                snapshot.packageVersion,

            examTitle:
                snapshot.examTitle,

            durationMinutes:
                snapshot.durationMinutes,

            startTime:
                snapshot.startTime.toISOString(),

            endTime:
                snapshot.endTime.toISOString(),

            assessmentType:
                snapshot.assessmentType,

            frozenAt:
                snapshot.frozenAt.toISOString(),

            subjects: clientSubjects,
        });
    } catch (error: any) {
        console.error(
            "Offline exam snapshot error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to prepare offline examination.",
            },
            { status: 500 }
        );
    }
}