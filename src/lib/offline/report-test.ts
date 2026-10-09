import {
    addToOfflineSyncQueue,
    getOfflineQuestionReports,
    getOfflineExamSessionForStudent,
    getExamPackageForStudent,
    saveOfflineQuestionReport,
} from "./db";

import { syncOfflineData } from "./sync";

import type {
    OfflineQuestionReport,
} from "./types";

export async function testOfflineQuestionReport(
    examId: string
) {
    // Get the currently logged-in student
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

    // Make sure an offline exam session exists
    const offlineSession =
        await getOfflineExamSessionForStudent(
            examId,
            studentId
        );

    if (!offlineSession) {
        throw new Error(
            "No offline Physics exam session was found. " +
            "Create the offline exam session first."
        );
    }

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

    // Get the frozen Physics package
    const examPackage =
        await getExamPackageForStudent(
            examId,
            studentId
        );

    if (!examPackage) {
        throw new Error(
            "No Physics offline package was found in IndexedDB."
        );
    }

    // Get the first question from the frozen package
    const firstSubject =
        examPackage.subjects[0];

    if (!firstSubject) {
        throw new Error(
            "The offline Physics package contains no subjects."
        );
    }

    const firstQuestion =
        firstSubject.questions[0];

    if (!firstQuestion) {
        throw new Error(
            "The offline Physics package contains no questions."
        );
    }

    // Create a local question report
    const offlineReport: OfflineQuestionReport = {
        id: crypto.randomUUID(),
        examId: examId,
        studentId,
        questionId: firstQuestion.id,
        reason:
            "Test report — question needs review.",
        createdAt:
            new Date().toISOString(),
        syncStatus: "PENDING",
    };

    // Save report locally
    await saveOfflineQuestionReport(
        offlineReport
    );

    // Read reports back from IndexedDB
    const storedReports =
        await getOfflineQuestionReports(
            examId,
            studentId
        );

    if (!storedReports.length) {
        throw new Error(
            "Question report was saved but no reports were retrieved from IndexedDB."
        );
    }

    // Find the report we just created
    const storedReport =
        storedReports.find(
            (report) =>
                report.id ===
                offlineReport.id
        );

    if (!storedReport) {
        throw new Error(
            "The newly created question report could not be found in IndexedDB."
        );
    }

    // Verify important fields
    if (
        storedReport.examId !==
        examId
    ) {
        throw new Error(
            "Stored question report exam ID does not match the Physics exam."
        );
    }

    if (
        storedReport.studentId !==
        studentId
    ) {
        throw new Error(
            "Stored question report student ID does not match the logged-in student."
        );
    }

    if (
        storedReport.questionId !==
        firstQuestion.id
    ) {
        throw new Error(
            "Stored question report question ID does not match the reported question."
        );
    }

    if (
        storedReport.syncStatus !==
        "PENDING"
    ) {
        throw new Error(
            "New offline question reports should initially have PENDING sync status."
        );
    }

    if (!storedReport.reason) {
        throw new Error(
            "Stored question report reason is empty."
        );
    }

    // Add the report to the offline synchronization queue
    await addToOfflineSyncQueue({
        id: crypto.randomUUID(),
        examId: examId,
        studentId,
        type: "QUESTION_REPORT",
        payload: {
            questionId: storedReport.questionId,
            reason: storedReport.reason,
        },
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: "PENDING",
        lastAttemptAt: null,
        error: null,
    });

    // Synchronize the report with the real server endpoint
    const syncResult =
        await syncOfflineData(
            examId
        );

    if (syncResult.succeeded < 1) {
        throw new Error(
            "Question report synchronization failed. " +
            `Processed: ${syncResult.processed}, ` +
            `Succeeded: ${syncResult.succeeded}, ` +
            `Failed: ${syncResult.failed}. ` +
            `Reason: ${syncResult.errors?.[0] || "Unknown synchronization error."}`
        );
    }

    return {
        message:
            "SUCCESS — Offline question report was saved locally and synchronized with the real QuestionReport endpoint.",
        reportId: storedReport.id,
        examId: storedReport.examId,
        studentId: storedReport.studentId,
        questionId: storedReport.questionId,
        reason: storedReport.reason,
        createdAt: storedReport.createdAt,
        syncStatus: "SYNCED",
    };
}