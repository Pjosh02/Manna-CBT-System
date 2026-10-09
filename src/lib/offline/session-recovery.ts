import {
    getOfflineExamSessionForStudent,
} from "./db";

import type {
    OfflineExamSession,
} from "./types";

export interface OfflineSessionRecovery {
    session: OfflineExamSession;
    remainingSeconds: number;
    expired: boolean;
}

/**
 * Restores an existing offline exam session for a student.
 *
 * The timer is calculated from the persisted deadline rather
 * than from the current page load time. This means closing
 * and reopening the browser does not reset the examination timer.
 */
export async function recoverOfflineExamSession(
    examId: string,
    studentId: string
): Promise<OfflineSessionRecovery | null> {
    const session =
        await getOfflineExamSessionForStudent(
            examId,
            studentId
        );

    if (!session) {
        return null;
    }

    const deadlineMs =
        new Date(session.deadline).getTime();

    if (!Number.isFinite(deadlineMs)) {
        throw new Error(
            "Offline exam session has an invalid deadline."
        );
    }

    const remainingMs =
        deadlineMs - Date.now();

    const remainingSeconds = Math.max(
        0,
        Math.ceil(
            remainingMs / 1000
        )
    );

    return {
        session,
        remainingSeconds,
        expired:
            remainingSeconds <= 0,
    };
}