import {
    getOfflineExamSessionForStudent,
    saveOfflineExamSession,
} from "./db";

import type {
    OfflineExamSession,
} from "./types";

import {
    createOfflineSessionId,
} from "./db";

export async function startOrResumeOfflineExamSession(
    examId: string,
    studentId: string,
    packageId: string,
    durationMinutes: number
): Promise<OfflineExamSession> {
    const existingSession =
        await getOfflineExamSessionForStudent(
            examId,
            studentId
        );

    if (existingSession) {
        return existingSession;
    }

    const startedAt =
        new Date().toISOString();

    const deadline =
        new Date(
            Date.now() +
            durationMinutes * 60 * 1000
        ).toISOString();

    const session: OfflineExamSession = {
        id: createOfflineSessionId(
            examId,
            studentId
        ),
        examId,
        studentId,
        packageId,
        status: "IN_PROGRESS",
        startedAt,
        deadline,
        submittedAt: null,
        tabSwitches: 0,
        syncStatus: "PENDING",
        lastSyncAttemptAt: null,
        syncError: null,
    };

    await saveOfflineExamSession(
        session
    );

    return session;
}