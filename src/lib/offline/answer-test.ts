import {
    createOfflineAnswerId,
    getOfflineAnswer,
    getOfflineExamSessionForStudent,
    saveOfflineAnswer,
} from "./db";

import type {
    OfflineAnswer,
} from "./types";

export async function testOfflineAnswer(
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

    // Get the saved exam package
    const packageResponse =
        await import("./db").then(
            ({ getExamPackageForStudent }) =>
                getExamPackageForStudent(
                    examId,
                    studentId
                )
        );

    if (!packageResponse) {
        throw new Error(
            "No Physics offline package was found."
        );
    }

    // Find the first question in the frozen package
    const firstSubject =
        packageResponse.subjects[0];

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

    // Create a local answer
    const offlineAnswer: OfflineAnswer = {
        id: createOfflineAnswerId(
            examId,
            studentId,
            firstQuestion.id
        ),
        examId: examId,
        studentId,
        subjectId: firstSubject.subjectId,
        questionId: firstQuestion.id,
        selectedOption: "A",
        isFlagged: false,
        answeredAt: new Date().toISOString(),
        syncStatus: "PENDING",
    };

    // Save answer locally
    await saveOfflineAnswer(
        offlineAnswer
    );

    // Read it back from IndexedDB
    const storedAnswer =
        await getOfflineAnswer(
            offlineAnswer.id
        );

    if (!storedAnswer) {
        throw new Error(
            "Answer was saved but could not be retrieved from IndexedDB."
        );
    }

    // Verify the important fields
    if (
        storedAnswer.examId !==
        examId
    ) {
        throw new Error(
            "Stored answer exam ID does not match the Physics exam."
        );
    }

    if (
        storedAnswer.studentId !==
        studentId
    ) {
        throw new Error(
            "Stored answer student ID does not match the logged-in student."
        );
    }

    if (
        storedAnswer.questionId !==
        firstQuestion.id
    ) {
        throw new Error(
            "Stored answer question ID does not match the question."
        );
    }

    if (
        storedAnswer.selectedOption !==
        "A"
    ) {
        throw new Error(
            "Stored answer did not preserve the selected option."
        );
    }

    if (
        storedAnswer.syncStatus !==
        "PENDING"
    ) {
        throw new Error(
            "New offline answer should initially have PENDING sync status."
        );
    }

    return {
        message:
            "SUCCESS — Offline answer saved and restored from IndexedDB.",
        examId: storedAnswer.examId,
        studentId: storedAnswer.studentId,
        questionId: storedAnswer.questionId,
        selectedOption:
            storedAnswer.selectedOption,
        isFlagged:
            storedAnswer.isFlagged,
        syncStatus:
            storedAnswer.syncStatus,
        answeredAt:
            storedAnswer.answeredAt,
    };
}