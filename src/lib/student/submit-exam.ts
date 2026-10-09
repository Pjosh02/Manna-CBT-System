import { prisma } from "@/lib/db";

function hashString(str: string): number {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return hash;
}

type PrismaTransaction = Parameters<
    Parameters<typeof prisma.$transaction>[0]
>[0];

export async function calculateExamSubmission(
    db: PrismaTransaction,
    examId: string,
    studentId: string
) {
    // Check if result already exists
    const existingResult =
        await db.result.findUnique({
            where: {
                examId_studentId: {
                    examId,
                    studentId,
                },
            },
        });

    if (existingResult) {
        throw new Error("Exam already submitted");
    }

    // Fetch exam and associated subjects
    const exam =
        await db.exam.findUnique({
            where: { id: examId },
            include: {
                examSubjects: true,
            },
        });

    if (!exam) {
        throw new Error("Exam not found");
    }

    // Check for frozen offline snapshot
    const offlineSnapshot =
        await db.offlineExamSnapshot.findUnique({
            where: {
                examId_studentId: {
                    examId,
                    studentId,
                },
            },
        });

    let snapshotSubjects: any[] = [];

    if (offlineSnapshot) {
        const storedSnapshot =
            offlineSnapshot.snapshot as any;

        snapshotSubjects =
            Array.isArray(storedSnapshot.subjects)
                ? storedSnapshot.subjects
                : [];
    }

    let totalQuestionsCount = 0;
    let totalAssignedQuestions = 0;
    let correctAnswersCount = 0;
    let firstAssignedQuestionType:
        string | null = null;

    // Fetch student's attempts
    const attempts =
        await db.studentAttempt.findMany({
            where: {
                examId,
                studentId,
            },
        });

    const attemptsMap =
        attempts.reduce(
            (acc: Record<string, string | null>, att) => {
                acc[att.questionId] =
                    att.selectedOption;

                return acc;
            },
            {}
        );

    for (const es of exam.examSubjects) {
        let assignedQuestions: any[] = [];

        // Use frozen offline snapshot when available
        if (offlineSnapshot) {
            const snapshotSubject =
                snapshotSubjects.find(
                    (subject: any) =>
                        subject.subjectId ===
                        es.subjectId
                );

            if (!snapshotSubject) {
                throw new Error(
                    `Offline snapshot is missing subject ${es.subjectId}.`
                );
            }

            assignedQuestions =
                Array.isArray(
                    snapshotSubject.questions
                )
                    ? snapshotSubject.questions
                    : [];
        } else {
            // Existing online behavior
            const allSubjectQuestions =
                await db.question.findMany({
                    where: {
                        subjectId: es.subjectId,
                        status: "PUBLISHED",
                        assessmentType:
                            exam.assessmentType ||
                            "Exam",
                    },
                });

            const shuffled =
                allSubjectQuestions
                    .map((q: any) => ({
                        q,
                        hash: hashString(
                            studentId + q.id
                        ),
                    }))
                    .sort(
                        (a: any, b: any) =>
                            a.hash - b.hash
                    )
                    .map(
                        (item: any) =>
                            item.q
                    );

            assignedQuestions =
                shuffled.slice(
                    0,
                    es.numberOfQuestions
                );
        }

        // Keep THEORY questions after objective questions
        assignedQuestions.sort(
            (a: any, b: any) => {
                if (
                    a.questionType ===
                    "THEORY" &&
                    b.questionType !==
                    "THEORY"
                ) {
                    return 1;
                }

                if (
                    a.questionType !==
                    "THEORY" &&
                    b.questionType ===
                    "THEORY"
                ) {
                    return -1;
                }

                return 0;
            }
        );

        totalAssignedQuestions +=
            assignedQuestions.length;

        const mcqQuestions =
            assignedQuestions.filter(
                (q: any) =>
                    q.questionType !==
                    "THEORY"
            );

        totalQuestionsCount +=
            mcqQuestions.length;

        if (
            assignedQuestions.length > 0 &&
            !firstAssignedQuestionType
        ) {
            firstAssignedQuestionType =
                assignedQuestions[0]
                    .assessmentType;
        }

        mcqQuestions.forEach(
            (q: any) => {
                const studentSelect =
                    attemptsMap[q.id];

                if (
                    studentSelect &&
                    q.correctOption &&
                    studentSelect
                        .toUpperCase() ===
                    q.correctOption
                        .toUpperCase()
                ) {
                    correctAnswersCount += 1;
                }
            }
        );
    }

    if (totalAssignedQuestions === 0) {
        throw new Error(
            "This exam has no questions configured."
        );
    }

    const score =
        totalQuestionsCount > 0
            ? Math.round(
                (correctAnswersCount /
                    totalQuestionsCount) *
                10000
            ) / 100
            : 0;

    return {
        exam,
        totalQuestionsCount,
        totalAssignedQuestions,
        correctAnswersCount,
        firstAssignedQuestionType,
        score,
    };
}

export async function persistExamSubmission(
    db: PrismaTransaction,
    {
        examId,
        studentId,
        timeSpent,
        submission,
    }: {
        examId: string;
        studentId: string;
        timeSpent: number;
        submission: Awaited<
            ReturnType<
                typeof calculateExamSubmission
            >
        >;
    }
) {
    const {
        exam,
        totalQuestionsCount,
        correctAnswersCount,
        firstAssignedQuestionType,
        score,
    } = submission;

    // Create Result
    const result =
        await db.result.create({
            data: {
                examId,
                studentId,
                score,
                correctAnswers:
                    correctAnswersCount,
                totalQuestions:
                    totalQuestionsCount,
                timeSpent,
            },
            include: {
                exam: true,
            },
        });

    // Determine assessment type
    let assessmentType = "Exam";

    if (
        firstAssignedQuestionType ===
        "1st CA" ||
        firstAssignedQuestionType ===
        "2nd CA" ||
        firstAssignedQuestionType ===
        "Exam"
    ) {
        assessmentType =
            firstAssignedQuestionType;
    } else {
        const titleLower =
            exam.title.toLowerCase();

        if (
            titleLower.includes("1st ca") ||
            titleLower.includes("first ca")
        ) {
            assessmentType = "1st CA";
        } else if (
            titleLower.includes("2nd ca") ||
            titleLower.includes("second ca")
        ) {
            assessmentType = "2nd CA";
        }
    }

    let caField:
        | "firstCA"
        | "secondCA"
        | "examScore"
        | null = null;

    let maxScore = 100;

    if (assessmentType === "1st CA") {
        caField = "firstCA";
        maxScore = 20;
    } else if (
        assessmentType === "2nd CA"
    ) {
        caField = "secondCA";
        maxScore = 20;
    } else {
        caField = "examScore";
        maxScore = 60;
    }

    if (
        caField &&
        totalQuestionsCount > 0
    ) {
        const scaledScore =
            Math.round(
                (correctAnswersCount /
                    totalQuestionsCount) *
                maxScore *
                100
            ) / 100;

        // Update subject-specific scores
        for (const es of exam.examSubjects) {
            await db.subjectScore.upsert({
                where: {
                    studentId_subjectId: {
                        studentId,
                        subjectId:
                            es.subjectId,
                    },
                },
                update: {
                    [caField]: scaledScore,
                },
                create: {
                    studentId,
                    subjectId:
                        es.subjectId,
                    [caField]: scaledScore,
                },
            });
        }

        // Legacy User score
        await db.user.update({
            where: {
                id: studentId,
            },
            data: {
                [caField]: scaledScore,
            },
        });
    }

    // Update ExamSession
    await db.examSession.upsert({
        where: {
            examId_studentId: {
                examId,
                studentId,
            },
        },
        update: {
            status: "SUBMITTED",
            lastPing: new Date(),
        },
        create: {
            examId,
            studentId,
            status: "SUBMITTED",
        },
    });

    return {
        result,
        examTitle:
            result.exam.title,
        score: result.score,
        totalQuestions:
            result.totalQuestions,
        correctAnswers:
            correctAnswersCount,
        timeSpent:
            result.timeSpent,
    };
}