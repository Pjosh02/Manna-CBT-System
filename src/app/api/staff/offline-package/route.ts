import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import { createHash } from "crypto";

function hashString(str: string): number {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return hash;
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

function sanitizeForStudent(snapshotData: any) {
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

export async function POST(request: NextRequest) {
    try {
        /*
         * ------------------------------------------------------------
         * 1. AUTHENTICATE ADMIN / TEACHER
         * ------------------------------------------------------------
         */

        const token =
            request.cookies.get("token")?.value;

        const payload = token
            ? await verifyJWT(token)
            : null;

        if (
            !payload ||
            payload.role !== "ADMIN"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unauthorized. Only administrators can prepare offline packages.",
                },
                { status: 401 }
            );
        }

        /*
         * ------------------------------------------------------------
         * 2. READ REQUEST
         * ------------------------------------------------------------
         */

        const body = await request.json();

        const examId = body?.examId;
        const studentId = body?.studentId;

        if (!examId) {
            return NextResponse.json(
                {
                    error: "Exam ID is required.",
                },
                { status: 400 }
            );
        }

        if (!studentId) {
            return NextResponse.json(
                {
                    error: "Student ID is required.",
                },
                { status: 400 }
            );
        }

        /*
         * ------------------------------------------------------------
         * 3. LOAD EXAM
         * ------------------------------------------------------------
         */

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
                {
                    error: "Exam not found.",
                },
                { status: 404 }
            );
        }

        /*
         * Offline preparation should only happen for LIVE exams.
         */

        if (exam.status !== "LIVE") {
            return NextResponse.json(
                {
                    error:
                        "This examination is not currently available for offline preparation.",
                },
                { status: 400 }
            );
        }

        /*
         * ------------------------------------------------------------
         * 4. LOAD STUDENT
         * ------------------------------------------------------------
         */

        const student = await prisma.user.findUnique({
            where: {
                id: studentId,
            },

            select: {
                id: true,
                name: true,
                classId: true,
                role: true,
            },
        });

        if (
            !student ||
            student.role !== "STUDENT"
        ) {
            return NextResponse.json(
                {
                    error:
                        "The selected student account was not found.",
                },
                { status: 404 }
            );
        }

        /*
         * ------------------------------------------------------------
         * 5. VERIFY CLASS
         * ------------------------------------------------------------
         *
         * A staff member cannot prepare an exam package for
         * a student outside the examination class.
         */

        if (student.classId !== exam.classId) {
            return NextResponse.json(
                {
                    error:
                        "This student is not assigned to the class for this examination.",
                },
                { status: 403 }
            );
        }

        /*
         * ------------------------------------------------------------
         * 6. CHECK EXISTING RESULT
         * ------------------------------------------------------------
         */

        const existingResult =
            await prisma.result.findUnique({
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
                        "This student has already completed this examination.",
                },
                { status: 409 }
            );
        }

        /*
         * ------------------------------------------------------------
         * 7. CHECK EXISTING SNAPSHOT
         * ------------------------------------------------------------
         *
         * NEVER rebuild an existing frozen package.
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

            const safeSnapshot =
                sanitizeForStudent(storedSnapshot);

            return NextResponse.json({
                success: true,
                existing: true,

                student: {
                    id: student.id,
                    name: student.name,
                },

                snapshotId:
                    existingSnapshot.id,

                packageVersion:
                    existingSnapshot.packageVersion,

                examTitle:
                    existingSnapshot.examTitle,

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

        /*
         * ------------------------------------------------------------
         * 8. BUILD FROZEN QUESTION PACKAGE
         * ------------------------------------------------------------
         */

        const subjects = [];

        for (const examSubject of exam.examSubjects) {
            const allQuestions =
                await prisma.question.findMany({
                    where: {
                        subjectId:
                            examSubject.subjectId,

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

            /*
             * Make sure the question bank contains enough
             * questions before creating the package.
             */

            if (
                assignedQuestions.length <
                examSubject.numberOfQuestions
            ) {
                return NextResponse.json(
                    {
                        error:
                            `Not enough published questions are available for ${examSubject.subject.name}. Required: ${examSubject.numberOfQuestions}, available: ${assignedQuestions.length}.`,
                    },
                    { status: 400 }
                );
            }

            const snapshotQuestions =
                assignedQuestions.map(
                    (question: any, index: number) => ({
                        id: question.id,

                        subjectId:
                            question.subjectId,

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
                         * This is stored in the database snapshot
                         * but removed before the browser receives
                         * the package.
                         */
                        correctOption:
                            question.correctOption,
                    })
                );

            subjects.push({
                subjectId:
                    examSubject.subjectId,

                subjectName:
                    examSubject.subject.name,

                numberOfQuestions:
                    examSubject.numberOfQuestions,

                questions:
                    snapshotQuestions,
            });
        }

        /*
         * ------------------------------------------------------------
         * 9. BUILD SNAPSHOT
         * ------------------------------------------------------------
         */

        const snapshotData = {
            examId,
            studentId,
            subjects,
        };

        const snapshotHash =
            createSnapshotHash(snapshotData);

        /*
         * ------------------------------------------------------------
         * 10. SAVE FROZEN SNAPSHOT
         * ------------------------------------------------------------
         */

        const snapshot =
            await prisma.offlineExamSnapshot.create({
                data: {
                    examId,

                    studentId,

                    packageVersion: 1,

                    examTitle:
                        exam.title,

                    durationMinutes:
                        exam.durationMinutes,

                    startTime:
                        exam.startTime,

                    endTime:
                        exam.endTime,

                    assessmentType:
                        exam.assessmentType || "Exam",

                    snapshotHash,

                    snapshot:
                        snapshotData,
                },
            });

        /*
         * ------------------------------------------------------------
         * 11. REMOVE CORRECT ANSWERS
         * ------------------------------------------------------------
         */

        const clientSnapshot =
            sanitizeForStudent(snapshotData);

        /*
         * ------------------------------------------------------------
         * 12. RETURN SAFE PACKAGE
         * ------------------------------------------------------------
         */

        return NextResponse.json({
            success: true,

            existing: false,

            student: {
                id: student.id,
                name: student.name,
            },

            snapshotId:
                snapshot.id,

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

            subjects:
                clientSnapshot.subjects,
        });
    } catch (error: any) {
        console.error(
            "Staff offline package preparation error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to prepare the offline examination package.",
            },
            { status: 500 }
        );
    }
}