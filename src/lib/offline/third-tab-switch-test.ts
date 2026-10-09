import {
    addToOfflineSyncQueue,
    getExamPackageForStudent,
    getOfflineExamSessionForStudent,
    saveOfflineExamSession,
} from "@/lib/offline/db";

import {
    syncOfflineData,
} from "@/lib/offline/sync";

const TEST_EXAM_ID =
    "2b3cd91f-f326-47ed-9881-62b97e39cb14";

export async function testOfflineThirdTabSwitchSubmission() {
    // ------------------------------------------------------------
    // 1. Find the existing offline Physics package
    // ------------------------------------------------------------

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
     * Find this student's offline Physics package.
     */
    const examPackage =
        await getExamPackageForStudent(
            TEST_EXAM_ID,
            studentId
        );

    if (!examPackage) {
        throw new Error(
            "No offline Physics exam package was found for this student. Run the offline package test first."
        );
    }

    const examId =
        examPackage.examId;

    const packageId =
        examPackage.id;


    // ------------------------------------------------------------
    // 2. Find the existing offline session
    // ------------------------------------------------------------

    const existingSession =
        await getOfflineExamSessionForStudent(
            examId,
            studentId
        );

    if (!existingSession) {
        throw new Error(
            "No offline Physics exam session was found for this student. Create an offline session first."
        );
    }

    // ------------------------------------------------------------
    // 3. Reset the local session into a controlled test state
    // ------------------------------------------------------------

    const session = {
        ...existingSession,
        packageId,
        status: "IN_PROGRESS" as const,
        submittedAt: null,
        tabSwitches: 0,
        syncStatus: "PENDING" as const,
        lastSyncAttemptAt: null,
        syncError: null,
    };

    await saveOfflineExamSession(
        session
    );

    // ------------------------------------------------------------
    // 4. Create three TAB_SWITCH events
    // ------------------------------------------------------------

    const baseTime =
        Date.now();

    for (
        let sequenceNumber = 1;
        sequenceNumber <= 3;
        sequenceNumber += 1
    ) {
        const timestamp =
            new Date(
                baseTime +
                sequenceNumber * 1000
            ).toISOString();

        await addToOfflineSyncQueue({
            id:
                `third-tab-test-proctor-${examId}-${studentId}-${sequenceNumber}`,

            examId,

            studentId,

            type: "PROCTOR_EVENT",

            payload: {
                examId,
                studentId,
                type: "TAB_SWITCH",
                timestamp,
                sequenceNumber,
                metadata: {
                    source:
                        "third-tab-switch-test",
                    test: true,
                },
            },

            createdAt:
                timestamp,

            attempts: 0,

            status: "PENDING",

            lastAttemptAt: null,

            error: null,
        });
    }

    // ------------------------------------------------------------
    // 5. Create the final SUBMIT_EXAM queue item
    // ------------------------------------------------------------

    const submittedAt =
        new Date(
            baseTime + 4000
        ).toISOString();

    await addToOfflineSyncQueue({
        id:
            `third-tab-test-submit-${examId}-${studentId}`,

        examId,

        studentId,

        type: "SUBMIT_EXAM",

        payload: {
            examId,
            studentId,
            timeSpent: 60,
        },

        createdAt:
            submittedAt,

        attempts: 0,

        status: "PENDING",

        lastAttemptAt: null,

        error: null,
    });

    // ------------------------------------------------------------
    // 6. Synchronize everything using the SAFE rollback endpoint
    // ------------------------------------------------------------

    const result =
        await syncOfflineData(
            examId,
            {
                submissionEndpoint:
                    "/api/student/test/offline-submit-test",
            }
        );

    // ------------------------------------------------------------
    // 7. Return the complete test result
    // ------------------------------------------------------------

    return {
        success:
            result.failed === 0,

        examId,

        studentId,

        processed:
            result.processed,

        succeeded:
            result.succeeded,

        failed:
            result.failed,

        errors:
            result.errors,

        expected:
        {
            processed: 4,
            succeeded: 4,
            failed: 0,
            sequence:
                [
                    "TAB_SWITCH #1",
                    "TAB_SWITCH #2",
                    "TAB_SWITCH #3",
                    "SUBMIT_EXAM",
                ],
        },

        message:
            result.failed === 0
                ? "SUCCESS — Third tab-switch offline auto-submission synchronized through the safe rollback endpoint."
                : "FAILED — One or more offline synchronization items failed.",
    };
}