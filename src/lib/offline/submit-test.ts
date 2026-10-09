import {
    addToOfflineSyncQueue,
    getOfflineExamSession,
    getPendingOfflineSyncItems,
    getExamPackageForStudent,
    saveOfflineExamSession,
} from "./db";

import {
    createOfflineSessionId,
} from "./db";

import {
    syncOfflineData,
} from "./sync";

import type {
    OfflineExamSession,
} from "./types";


export async function testOfflineSubmission(
    examId: string
) {
    try {
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
         * 2. Confirm that the offline package exists.
         */
        const examPackage =
            await getExamPackageForStudent(
                examId,
                studentId
            );

        if (!examPackage) {
            throw new Error(
                "No Physics offline package was found. Create the offline package first."
            );
        }

        /*
         * 3. Get the existing offline session.
         */
        const sessionId =
            createOfflineSessionId(
                examId,
                studentId
            );

        let offlineSession =
            await getOfflineExamSession(
                sessionId
            );

        /*
         * 4. Create a local offline session
         *    if one does not already exist.
         */
        if (!offlineSession) {
            const startedAt =
                new Date().toISOString();

            const deadline =
                new Date(
                    Date.now() +
                    examPackage.durationMinutes *
                    60 *
                    1000
                ).toISOString();

            const newSession: OfflineExamSession = {
                id: sessionId,
                examId,
                studentId,
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

            await saveOfflineExamSession(
                newSession
            );

            offlineSession = newSession;
        }

        /*
         * 5. Make sure this session belongs
         *    to the correct student and exam.
         */
        if (
            offlineSession.examId !==
            examId
        ) {
            throw new Error(
                "Security check failed: offline session belongs to another exam."
            );
        }

        if (
            offlineSession.studentId !==
            studentId
        ) {
            throw new Error(
                "Security check failed: offline session belongs to another student."
            );
        }

        /*
         * 6. Create the local submission queue item.
         *
         * IMPORTANT:
         * This does NOT submit the actual Physics CBT.
         * It only tests the offline synchronization pipeline.
         */
        const queueItem = {
            id: crypto.randomUUID(),
            examId,
            studentId,
            type: "SUBMIT_EXAM" as const,
            payload: {
                examId,
                timeSpent: 60,
            },
            createdAt:
                new Date().toISOString(),
            attempts: 0,
            status: "PENDING" as const,
            lastAttemptAt: null,
            error: null,
        };

        await addToOfflineSyncQueue(
            queueItem
        );

        /*
         * 7. Synchronize the queued submission
         *    with the real server.
         */
        const syncResult =
            await syncOfflineData(
                examId,
                {
                    submissionEndpoint:
                        "/api/student/test/offline-submit-test",
                }
            );

        if (syncResult.failed > 0) {
            const serverError =
                syncResult.errors?.[0] ||
                "Unknown synchronization error.";

            throw new Error(
                `Offline submission synchronization failed. ` +
                `Processed: ${syncResult.processed}, ` +
                `Succeeded: ${syncResult.succeeded}, ` +
                `Failed: ${syncResult.failed}. ` +
                `Reason: ${serverError}`
            );
        }

        if (syncResult.succeeded < 1) {
            throw new Error(
                "The offline submission was not synchronized."
            );
        }

        /*
         * 8. Confirm that the submission queue item
         *    was removed after successful synchronization.
         */
        const remainingItems =
            await getPendingOfflineSyncItems();

        const stillQueued =
            remainingItems.find(
                (item) =>
                    item.id ===
                    queueItem.id
            );

        if (stillQueued) {
            throw new Error(
                "The submission synchronized but remained in the sync queue."
            );
        }

        return {
            success: true,
            message:
                "SUCCESS — Offline submission pipeline was synchronized with the SAFE rollback test endpoint.",
            examId,
            syncProcessed:
                syncResult.processed,
            syncSucceeded:
                syncResult.succeeded,
            syncFailed:
                syncResult.failed,
            removedFromSyncQueue: true,
        };
    } catch (error: unknown) {
        console.error(
            "Offline submission test failed:",
            error
        );

        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Offline submission synchronization test failed.",
        };
    }
}