import {
    deleteOfflineSyncQueueItem,
    getOfflineExamSessionForStudent,
    getPendingOfflineSyncItems,
    saveOfflineExamSession,
    updateOfflineSyncQueueItem,
} from "@/lib/offline/db";

import type {
    OfflineSyncQueueItem,
} from "@/lib/offline/types";

interface SyncResult {
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
}

async function syncAnswer(
    item: OfflineSyncQueueItem
): Promise<void> {
    const payload = item.payload as {
        examId: string;
        subjectId: string;
        questionId: string;
        selectedOption: string | null;
        isFlagged: boolean;
    };

    const response = await fetch(
        "/api/student/test",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                examId: payload.examId,
                subjectId: payload.subjectId,
                questionId: payload.questionId,
                selectedOption: payload.selectedOption,
                isFlagged: payload.isFlagged,
            }),
        }
    );

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `Answer sync failed (${response.status}): ${text}`
        );
    }
}

async function syncQuestionReport(
    item: OfflineSyncQueueItem
): Promise<void> {
    const payload = item.payload as {
        examId: string;
        questionId: string;
        reason: string;
    };

    const response = await fetch(
        "/api/student/report",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                examId: payload.examId,
                questionId: payload.questionId,
                reason: payload.reason,
            }),
        }
    );

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `Question report sync failed (${response.status}): ${text}`
        );
    }
}

async function syncProctorEvent(
    item: OfflineSyncQueueItem
): Promise<void> {
    const payload = item.payload as {
        examId: string;
        type: string;
        timestamp: string;
        sequenceNumber: number;
        metadata?: Record<string, unknown>;
    };

    const response = await fetch(
        "/api/student/test/offline-proctor-event",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                examId: payload.examId,
                type: payload.type,
                timestamp: payload.timestamp,
                sequenceNumber:
                    payload.sequenceNumber,
                metadata:
                    payload.metadata ?? null,
            }),
        }
    );

    if (!response.ok) {
        const text =
            await response.text();

        throw new Error(
            `Proctor event sync failed (${response.status}): ${text}`
        );
    }
}

async function syncSubmitExam(
    item: OfflineSyncQueueItem,
    submissionEndpoint = "/api/student/test/submit"
) {
    const payload = item.payload as {
        examId: string;
        timeSpent: number;
    };

    const response = await fetch(
        submissionEndpoint,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                examId: payload.examId,
                timeSpent: payload.timeSpent,
            }),
        }
    );

    if (!response.ok) {
        let message =
            `Submission sync failed with status ${response.status}.`;

        try {
            const data = await response.json();

            if (data?.details) {
                message = data.details;
            } else if (data?.error) {
                message = data.error;
            }
        } catch {
            // Keep the default error message.
        }

        throw new Error(message);
    }

    const result = await response.json();

    /*
     * The server has successfully accepted the submission.
     * Only now mark the local offline session as SYNCED.
     */
    const session =
        await getOfflineExamSessionForStudent(
            item.examId,
            item.studentId
        );

    if (session) {
        await saveOfflineExamSession({
            ...session,
            status: "SYNCED",
            syncStatus: "SYNCED",
            lastSyncAttemptAt:
                new Date().toISOString(),
            syncError: null,
        });
    }

    return result;
}

async function processSyncItem(
    item: OfflineSyncQueueItem,
    submissionEndpoint?: string
): Promise<void> {
    switch (item.type) {
        case "ANSWER":
            await syncAnswer(item);
            break;

        case "QUESTION_REPORT":
            await syncQuestionReport(item);
            break;

        case "PROCTOR_EVENT":
            await syncProctorEvent(item);
            break;

        case "SUBMIT_EXAM":
            await syncSubmitExam(
                item,
                submissionEndpoint
            );
            break;

        default:
            throw new Error(
                `Unsupported sync item type: ${item.type}`
            );
    }
}

/*
 * Synchronization priority.
 *
 * Lower number = synchronized first.
 *
 * The final exam submission must always happen after
 * answers, reports, and proctor events.
 */
const SYNC_PRIORITY: Record<
    OfflineSyncQueueItem["type"],
    number
> = {
    ANSWER: 1,
    QUESTION_REPORT: 2,
    PROCTOR_EVENT: 3,
    SUBMIT_EXAM: 4,
};

export async function syncOfflineData(
    examId?: string,
    options?: {
        submissionEndpoint?: string;
    }
): Promise<SyncResult> {
    const items =
        await getPendingOfflineSyncItems(
            examId
        );

    /*
     * Process queue items using an explicit priority first,
     * then creation time within the same priority.
     *
     * This prevents a SUBMIT_EXAM item from being processed
     * before earlier ANSWER/REPORT/PROCTOR items.
     */
    const sortedItems =
        [...items].sort((a, b) => {
            const priorityDifference =
                SYNC_PRIORITY[a.type] -
                SYNC_PRIORITY[b.type];

            if (priorityDifference !== 0) {
                return priorityDifference;
            }

            return (
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );
        });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of sortedItems) {
        processed += 1;

        try {
            await updateOfflineSyncQueueItem({
                ...item,
                status: "SYNCING",
                attempts:
                    (item.attempts || 0) + 1,
                lastAttemptAt:
                    new Date().toISOString(),
                error: null,
            });

            await processSyncItem(
                item,
                options?.submissionEndpoint
            );

            await updateOfflineSyncQueueItem({
                ...item,
                status: "SYNCED",
                lastAttemptAt:
                    new Date().toISOString(),
                error: null,
            });

            /*
             * Once successfully synchronized,
             * the queue item no longer needs to remain
             * in the pending queue.
             */
            await deleteOfflineSyncQueueItem(
                item.id
            );

            succeeded += 1;
        } catch (error) {
            failed += 1;

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            errors.push(message);

            await updateOfflineSyncQueueItem({
                ...item,
                status: "FAILED",
                lastAttemptAt:
                    new Date().toISOString(),
                error: message,
            });

            /*
             * IMPORTANT:
             *
             * Do not continue to the final submission
             * if an earlier synchronization item failed.
             *
             * The remaining queue items stay pending/available
             * for the next synchronization attempt.
             */
            break;
        }
    }

    return {
        processed,
        succeeded,
        failed,
        errors,
    };
}