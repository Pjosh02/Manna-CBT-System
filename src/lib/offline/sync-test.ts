import {
    addToOfflineSyncQueue,
    createOfflineSessionId,
    getExamPackageForStudent,
    getOfflineExamSession,
    getOfflineAnswer,
    getPendingOfflineSyncItems,
    saveOfflineAnswer,
} from "@/lib/offline/db";
import { syncOfflineData } from "@/lib/offline/sync";
import type { OfflineAnswer } from "@/lib/offline/types";


export async function testOfflineAnswerSync(
    examId: string
) {
    try {
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

        const sessionId =
            createOfflineSessionId(
                examId,
                studentId
            );

        const session =
            await getOfflineExamSession(sessionId);

        if (!session) {
            throw new Error(
                "No offline Physics exam session found. Please create the offline session first."
            );
        }



        /*
         * Use a synthetic question ID.
         * This test is only testing the offline synchronization
         * infrastructure and will NOT submit the CBT.
         */
        const examPackage =
            await getExamPackageForStudent(
                examId,
                studentId
            );

        if (!examPackage) {
            throw new Error(
                "No Physics offline package was found in IndexedDB. Run the offline package test first."
            );
        }

        const testSubject = examPackage.subjects[0];

        if (!testSubject) {
            throw new Error("No subject found in the offline exam package.");
        }

        const testQuestion = testSubject.questions[0];

        if (!testQuestion) {
            throw new Error("No question found in the offline exam package.");
        }

        const subjectId = testSubject.subjectId;
        const questionId = testQuestion.id;

        const answerId = crypto.randomUUID();

        const offlineAnswer: OfflineAnswer = {
            id: answerId,
            examId: examId,
            studentId,
            subjectId,
            questionId,
            selectedOption: "A",
            isFlagged: false,
            answeredAt: new Date().toISOString(),
            syncStatus: "PENDING",
        };

        await saveOfflineAnswer(offlineAnswer);

        const savedAnswer =
            await getOfflineAnswer(answerId);

        if (!savedAnswer) {
            throw new Error(
                "Offline answer was not saved to IndexedDB."
            );
        }

        if (savedAnswer.selectedOption !== "A") {
            throw new Error(
                "Saved offline answer has an unexpected option."
            );
        }

        const queueItem = {
            id: crypto.randomUUID(),
            examId: examId,
            studentId,
            type: "ANSWER" as const,
            payload: {
                examId: examId,
                subjectId,
                questionId,
                selectedOption: "A",
                isFlagged: false,
            },
            createdAt: new Date().toISOString(),
            attempts: 0,
            status: "PENDING" as const,
            lastAttemptAt: null,
            error: null,
        };

        await addToOfflineSyncQueue(queueItem);

        const pendingItems =
            await getPendingOfflineSyncItems();

        const queuedItem = pendingItems.find(
            (item) => item.id === queueItem.id
        );

        if (!queuedItem) {
            throw new Error(
                "Offline answer was not added to the sync queue."
            );
        }

        /*
         * Use the REAL synchronization engine.
         * No fake fetch is used here.
         */
        const syncResult =
            await syncOfflineData();

        if (syncResult.failed > 0) {
            const serverError =
                syncResult.errors?.[0] ||
                "Unknown synchronization error.";

            throw new Error(
                `Answer synchronization failed. ` +
                `Processed: ${syncResult.processed}, ` +
                `Succeeded: ${syncResult.succeeded}, ` +
                `Failed: ${syncResult.failed}. ` +
                `Reason: ${serverError}`
            );
        }

        if (syncResult.succeeded < 1) {
            throw new Error(
                "The offline answer was not synchronized."
            );
        }

        const remainingItems =
            await getPendingOfflineSyncItems();

        const stillQueued = remainingItems.find(
            (item) => item.id === queueItem.id
        );

        if (stillQueued) {
            throw new Error(
                "The answer synchronized but remained in the sync queue."
            );
        }

        return {
            success: true,
            message:
                "SUCCESS — Offline answer was saved locally and synchronized with the real StudentAttempt endpoint.",
            examId,
            questionId,
            syncProcessed: syncResult.processed,
            syncSucceeded: syncResult.succeeded,
            syncFailed: syncResult.failed,
            removedFromSyncQueue: true,
        };
    } catch (error: unknown) {
        console.error(
            "Offline answer sync test failed:",
            error
        );

        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Offline answer synchronization test failed.",
        };
    }
}