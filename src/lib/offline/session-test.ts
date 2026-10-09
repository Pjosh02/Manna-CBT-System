import {
    createOfflineSessionId,
    getExamPackageForStudent,
    getOfflineExamSession,
    saveOfflineExamSession,
} from "./db";

import type {
    OfflineExamSession,
} from "./types";



export async function testOfflineExamSession(
    examId: string
) {
    /*
     * 1. Identify the logged-in student.
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

    const sessionData = await sessionResponse.json();

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
     * 2. Find the real Physics package already stored
     *    in IndexedDB.
     */
    const examPackage =
        await getExamPackageForStudent(
            examId,
            studentId
        );

    if (!examPackage) {
        throw new Error(
            "No Physics offline package was found in IndexedDB. " +
            "Run the offline package test first."
        );
    }

    /*
     * 3. Confirm the package belongs to this student
     *    and exam.
     */
    if (examPackage.studentId !== studentId) {
        throw new Error(
            "Security check failed: package belongs to another student."
        );
    }

    if (examPackage.examId !== examId) {
        throw new Error(
            "Security check failed: package belongs to another exam."
        );
    }

    /*
     * 4. Use the frozen package timing.
     *
     * We deliberately do NOT create a new arbitrary
     * deadline. The server-frozen package controls the
     * examination timing.
     */
    const startedAt = new Date().toISOString();

    const deadline = examPackage.endTime;

    const offlineSession: OfflineExamSession = {
        id: createOfflineSessionId(
            examPackage.examId,
            examPackage.studentId
        ),

        examId: examPackage.examId,

        studentId: examPackage.studentId,

        packageId: examPackage.id,

        status: "IN_PROGRESS",

        startedAt,

        deadline,

        submittedAt: null,

        tabSwitches: 0,

        syncStatus: "PENDING",

        lastSyncAttemptAt: null,

        syncError: null,
    };

    /*
     * 5. Save the session locally.
     */
    await saveOfflineExamSession(
        offlineSession
    );

    /*
     * 6. Read the session back.
     */
    const storedSession =
        await getOfflineExamSession(
            offlineSession.id
        );

    if (!storedSession) {
        throw new Error(
            "Session was saved but could not be retrieved from IndexedDB."
        );
    }

    /*
     * 7. Verify important session fields.
     */
    if (
        storedSession.examId !==
        examPackage.examId
    ) {
        throw new Error(
            "Session exam ID does not match the package."
        );
    }

    if (
        storedSession.studentId !==
        examPackage.studentId
    ) {
        throw new Error(
            "Session student ID does not match the package."
        );
    }

    if (
        storedSession.packageId !==
        examPackage.id
    ) {
        throw new Error(
            "Session package ID does not match the stored package."
        );
    }

    if (
        storedSession.deadline !==
        examPackage.endTime
    ) {
        throw new Error(
            "Session deadline does not match the frozen package deadline."
        );
    }

    if (
        storedSession.status !==
        "IN_PROGRESS"
    ) {
        throw new Error(
            "Session was not saved with IN_PROGRESS status."
        );
    }

    return {
        message:
            "SUCCESS — Offline exam session created and restored from IndexedDB.",

        sessionId:
            storedSession.id,

        examId:
            storedSession.examId,

        studentId:
            storedSession.studentId,

        packageId:
            storedSession.packageId,

        status:
            storedSession.status,

        startedAt:
            storedSession.startedAt,

        deadline:
            storedSession.deadline,

        tabSwitches:
            storedSession.tabSwitches,

        syncStatus:
            storedSession.syncStatus,
    };
}