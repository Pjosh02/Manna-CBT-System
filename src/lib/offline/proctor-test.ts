import {
    addToOfflineSyncQueue,
    getOfflineExamSessionForStudent,
    getOfflineProctorEvents,
    getPendingOfflineSyncItems,
    saveOfflineProctorEvent,
} from "./db";

import {
    syncOfflineData,
} from "./sync";

import type {
    OfflineProctorEvent,
} from "./types";


export async function testOfflineProctorEvent(
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

    // Get existing local proctor events
    const existingEvents =
        await getOfflineProctorEvents(
            examId,
            studentId
        );

    // Continue the local event sequence
    const nextSequenceNumber =
        existingEvents.length > 0
            ? Math.max(
                ...existingEvents.map(
                    (event) =>
                        event.sequenceNumber
                )
            ) + 1
            : 1;

    // Create a local TAB_SWITCH event
    const offlineEvent: OfflineProctorEvent = {
        id: crypto.randomUUID(),
        examId: examId,
        studentId,
        type: "BLUR",
        timestamp:
            new Date().toISOString(),
        sequenceNumber:
            nextSequenceNumber,
        metadata: {
            source: "OFFLINE_TEST",
            message:
                "Test blur event recorded locally.",
        },
        syncStatus: "PENDING",
    };

    // Save event to IndexedDB
    await saveOfflineProctorEvent(
        offlineEvent
    );

    // Add the same event to the offline sync queue.
    const syncQueueItem = {
        id: crypto.randomUUID(),
        examId: examId,
        studentId,
        type: "PROCTOR_EVENT" as const,
        payload: {
            examId: examId,
            type: offlineEvent.type,
            timestamp:
                offlineEvent.timestamp,
            sequenceNumber:
                offlineEvent.sequenceNumber,
            metadata:
                offlineEvent.metadata,
        },
        createdAt:
            new Date().toISOString(),
        attempts: 0,
        status: "PENDING" as const,
        lastAttemptAt: null,
        error: null,
    };

    await addToOfflineSyncQueue(
        syncQueueItem
    );

    // Synchronize the queued event with the real server endpoint.
    const syncResult =
        await syncOfflineData(
            examId
        );

    if (
        syncResult.succeeded < 1
    ) {
        throw new Error(
            "The offline proctor event was queued but the real server synchronization failed."
        );
    }

    // Confirm the successfully synchronized event
    // is no longer pending.
    const pendingItems =
        await getPendingOfflineSyncItems(
            examId
        );

    const stillPending =
        pendingItems.find(
            (item) =>
                item.id ===
                syncQueueItem.id
        );

    if (stillPending) {
        throw new Error(
            "The proctor event synchronized but remained in the pending sync queue."
        );
    }

    // Read events back from IndexedDB
    const storedEvents =
        await getOfflineProctorEvents(
            examId,
            studentId
        );

    if (!storedEvents.length) {
        throw new Error(
            "Proctor event was saved but no events were retrieved from IndexedDB."
        );
    }

    // Find the event we just created
    const storedEvent =
        storedEvents.find(
            (event) =>
                event.id ===
                offlineEvent.id
        );

    if (!storedEvent) {
        throw new Error(
            "The newly created proctor event could not be found in IndexedDB."
        );
    }

    // Verify important fields
    if (
        storedEvent.examId !==
        examId
    ) {
        throw new Error(
            "Stored proctor event exam ID does not match the Physics exam."
        );
    }

    if (
        storedEvent.studentId !==
        studentId
    ) {
        throw new Error(
            "Stored proctor event student ID does not match the logged-in student."
        );
    }

    if (
        storedEvent.type !==
        "BLUR"
    ) {
        throw new Error(
            "Stored proctor event type is incorrect."
        );
    }

    if (
        storedEvent.sequenceNumber !==
        nextSequenceNumber
    ) {
        throw new Error(
            "Stored proctor event sequence number is incorrect."
        );
    }

    if (
        storedEvent.syncStatus !==
        "PENDING"
    ) {
        throw new Error(
            "New offline proctor events should initially have PENDING sync status."
        );
    }

    return {
        message:
            "SUCCESS — Offline proctor event was saved locally and synchronized with the server.",
        eventId: storedEvent.id,
        examId: storedEvent.examId,
        studentId:
            storedEvent.studentId,
        type: storedEvent.type,
        sequenceNumber:
            storedEvent.sequenceNumber,
        timestamp:
            storedEvent.timestamp,
        syncStatus:
            storedEvent.syncStatus,
        syncProcessed:
            syncResult.processed,
        syncSucceeded:
            syncResult.succeeded,
        syncFailed:
            syncResult.failed,
        removedFromSyncQueue:
            true,
    };
}