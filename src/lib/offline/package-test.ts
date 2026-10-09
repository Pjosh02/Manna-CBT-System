import {
    getExamPackage,
    saveExamPackage,
} from "./db";

import type {
    OfflineExamPackage,
} from "./types";

interface OfflinePackageApiResponse {
    success?: boolean;
    existing?: boolean;
    snapshotId?: string;
    packageVersion?: number;
    examTitle?: string;
    durationMinutes?: number;
    startTime?: string;
    endTime?: string;
    assessmentType?: string;
    frozenAt?: string;
    examId?: string;
    studentId?: string;
    subjects?: OfflineExamPackage["subjects"];
    error?: string;
}

interface SessionResponse {
    user?: {
        id?: string;
        studentId?: string;
    };
    id?: string;
    studentId?: string;
}

export async function testOfflineExamPackage(
    examId: string
) {
    /*
     * 1. Get the currently logged-in student.
     */
    const sessionResponse = await fetch(
        "/api/auth/session",
        {
            credentials: "include",
            cache: "no-store",
        }
    );

    if (!sessionResponse.ok) {
        throw new Error(
            `Unable to identify logged-in student (${sessionResponse.status}).`
        );
    }

    const sessionData =
        (await sessionResponse.json()) as SessionResponse;

    const studentId =
        sessionData.user?.id ||
        sessionData.user?.studentId ||
        sessionData.id ||
        sessionData.studentId;

    if (!studentId) {
        throw new Error(
            "Could not determine the logged-in student's ID."
        );
    }

    /*
     * 2. Download the server-frozen offline package.
     */
    const response = await fetch(
        "/api/student/test/offline-package",
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                examId,
            }),
        }
    );

    const data =
        (await response.json()) as OfflinePackageApiResponse;

    if (!response.ok || !data.success) {
        throw new Error(
            data.error ||
            `Offline package request failed (${response.status}).`
        );
    }

    if (!data.snapshotId) {
        throw new Error(
            "Server did not return a snapshot ID."
        );
    }

    if (!data.examTitle) {
        throw new Error(
            "Server did not return the exam title."
        );
    }

    if (!data.startTime || !data.endTime) {
        throw new Error(
            "Server did not return the exam timing information."
        );
    }

    /*
     * 3. Build the client-safe IndexedDB package.
     *
     * The server response has already removed correctOption.
     * We also perform a defensive removal here before storage.
     */
    const safeSubjects = (data.subjects || []).map(
        (subject) => ({
            ...subject,
            questions: (subject.questions || []).map(
                (question) => {
                    const questionWithoutAnswer =
                        question as typeof question & {
                            correctOption?: unknown;
                        };

                    const {
                        correctOption: _correctOption,
                        ...safeQuestion
                    } = questionWithoutAnswer;

                    return safeQuestion;
                }
            ),
        })
    );

    const examPackage: OfflineExamPackage = {
        id: data.snapshotId,
        examId: data.examId || examId,
        studentId,

        examTitle: data.examTitle,
        durationMinutes:
            data.durationMinutes || 0,
        startTime: data.startTime,
        endTime: data.endTime,

        assessmentType:
            data.assessmentType || "Exam",

        packageVersion:
            data.packageVersion || 1,

        snapshotId: data.snapshotId,

        frozenAt:
            data.frozenAt ||
            new Date().toISOString(),

        subjects: safeSubjects,

        downloadedAt:
            new Date().toISOString(),

        expiresAt: data.endTime,
    };

    /*
     * 4. Verify that no answer key exists before saving.
     */
    const serializedPackage =
        JSON.stringify(examPackage);

    if (
        serializedPackage.includes(
            '"correctOption"'
        )
    ) {
        throw new Error(
            "SECURITY CHECK FAILED: correctOption was found in the offline package."
        );
    }

    /*
     * 5. Save the REAL package into IndexedDB.
     */
    await saveExamPackage(examPackage);
    localStorage.setItem(
        `cbt_exam_offline_${examPackage.examId}`,
        "true"
    );

    /*
     * 6. Read it back from IndexedDB.
     */
    const storedPackage =
        await getExamPackage(examPackage.id);

    if (!storedPackage) {
        throw new Error(
            "Package was saved but could not be retrieved from IndexedDB."
        );
    }

    /*
     * 7. Verify the stored copy also has no answer key.
     */
    const storedSerialized =
        JSON.stringify(storedPackage);

    if (
        storedSerialized.includes(
            '"correctOption"'
        )
    ) {
        throw new Error(
            "SECURITY CHECK FAILED: correctOption exists in IndexedDB."
        );
    }

    const totalQuestions =
        storedPackage.subjects.reduce(
            (total, subject) =>
                total + subject.questions.length,
            0
        );

    return {
        message:
            `SUCCESS — Real ${storedPackage.examTitle} package saved to IndexedDB. ` +
            `${totalQuestions} questions stored. ` +
            `correctOption is not present.`,
        snapshotId: storedPackage.id,
        existing: data.existing === true,
        totalQuestions,
        studentId: storedPackage.studentId,
        examId: storedPackage.examId,
    };
}