import {
    recoverOfflineExamSession,
} from "./session-recovery";


export async function testOfflineSessionRecovery(
    examId: string
) {
    try {
        /*
         * Identify the currently logged-in student.
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
            await sessionResponse.json();

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
         * Recover the existing offline session.
         */
        const recovery =
            await recoverOfflineExamSession(
                examId,
                studentId
            );

        if (!recovery) {
            throw new Error(
                "No offline Physics exam session was found for this student."
            );
        }

        const minutes = Math.floor(
            recovery.remainingSeconds / 60
        );

        const seconds =
            recovery.remainingSeconds % 60;

        return {
            success: true,
            message:
                recovery.expired
                    ? `SUCCESS — Offline session was recovered, and its deadline has expired. Session status: ${recovery.session.status}.`
                    : `SUCCESS — Offline session was recovered and the remaining time was calculated from the stored deadline. Session status: ${recovery.session.status}.`,
            examId,
            studentId,
            sessionId:
                recovery.session.id,
            status:
                recovery.session.status,
            startedAt:
                recovery.session.startedAt,
            deadline:
                recovery.session.deadline,
            remainingSeconds:
                recovery.remainingSeconds,
            remainingTime:
                `${minutes}m ${seconds}s`,
            expired:
                recovery.expired,
        };
    } catch (error) {
        console.error(
            "Offline session recovery test failed:",
            error
        );

        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Offline session recovery test failed.",
        };
    }
}