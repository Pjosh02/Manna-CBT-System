import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
    OFFLINE_DB_NAME,
    OFFLINE_DB_VERSION,
    OFFLINE_STORES,
} from "./constants";

import type {
    OfflineAnswer,
    OfflineExamPackage,
    OfflineExamSession,
    OfflineProctorEvent,
    OfflineQuestionReport,
    OfflineSyncQueueItem,
} from "./types";

/**
 * IndexedDB schema for MANNA CBT offline examination.
 */
interface MannaOfflineDB extends DBSchema {
    examPackages: {
        key: string;
        value: OfflineExamPackage;
        indexes: {
            "by-exam": string;
            "by-student": string;
            "by-exam-student": [string, string];
        };
    };

    examSessions: {
        key: string;
        value: OfflineExamSession;
        indexes: {
            "by-exam": string;
            "by-student": string;
            "by-exam-student": [string, string];
            "by-status": string;
        };
    };

    answers: {
        key: string;
        value: OfflineAnswer;
        indexes: {
            "by-exam": string;
            "by-student": string;
            "by-question": string;
            "by-exam-student": [string, string];
            "by-sync-status": string;
        };
    };

    proctorEvents: {
        key: string;
        value: OfflineProctorEvent;
        indexes: {
            "by-exam": string;
            "by-student": string;
            "by-exam-student": [string, string];
            "by-sync-status": string;
            "by-sequence": number;
        };
    };

    questionReports: {
        key: string;
        value: OfflineQuestionReport;
        indexes: {
            "by-exam": string;
            "by-student": string;
            "by-question": string;
            "by-exam-student": [string, string];
            "by-sync-status": string;
        };
    };

    syncQueue: {
        key: string;
        value: OfflineSyncQueueItem;
        indexes: {
            "by-exam": string;
            "by-student": string;
            "by-type": string;
            "by-status": string;
            "by-created-at": string;
        };
    };
}

let dbPromise: Promise<IDBPDatabase<MannaOfflineDB>> | null = null;

/**
 * Open the offline database.
 *
 * This is browser-only. Nothing here is executed on the server.
 */
export function getOfflineDB(): Promise<IDBPDatabase<MannaOfflineDB>> {
    if (typeof window === "undefined") {
        throw new Error("Offline database is only available in the browser.");
    }

    if (!dbPromise) {
        dbPromise = openDB<MannaOfflineDB>(
            OFFLINE_DB_NAME,
            OFFLINE_DB_VERSION,
            {
                upgrade(db, oldVersion, newVersion, transaction) {
                    const ensureIndex = (
                        store: any,
                        name: string,
                        keyPath: string | string[]
                    ) => {
                        if (!store.indexNames.contains(name)) {
                            store.createIndex(name, keyPath);
                        }
                    };

                    const removeIndex = (
                        store: any,
                        name: string
                    ) => {
                        if (store.indexNames.contains(name)) {
                            store.deleteIndex(name);
                        }
                    };

                    let store: any;

                    /*
                     * EXAM PACKAGES
                     */
                    if (!db.objectStoreNames.contains(OFFLINE_STORES.EXAM_PACKAGES)) {
                        store = db.createObjectStore(
                            OFFLINE_STORES.EXAM_PACKAGES,
                            { keyPath: "id" }
                        );
                    } else {
                        store = transaction.objectStore(
                            OFFLINE_STORES.EXAM_PACKAGES
                        );
                    }

                    ensureIndex(store, "by-exam", "examId");
                    ensureIndex(store, "by-student", "studentId");
                    ensureIndex(
                        store,
                        "by-exam-student",
                        ["examId", "studentId"]
                    );

                    /*
                     * EXAM SESSIONS
                     */
                    if (!db.objectStoreNames.contains(OFFLINE_STORES.EXAM_SESSIONS)) {
                        store = db.createObjectStore(
                            OFFLINE_STORES.EXAM_SESSIONS,
                            { keyPath: "id" }
                        );
                    } else {
                        store = transaction.objectStore(
                            OFFLINE_STORES.EXAM_SESSIONS
                        );
                    }

                    ensureIndex(store, "by-exam", "examId");
                    ensureIndex(store, "by-student", "studentId");
                    ensureIndex(
                        store,
                        "by-exam-student",
                        ["examId", "studentId"]
                    );
                    ensureIndex(store, "by-status", "status");

                    /*
                     * ANSWERS
                     */
                    if (!db.objectStoreNames.contains(OFFLINE_STORES.ANSWERS)) {
                        store = db.createObjectStore(
                            OFFLINE_STORES.ANSWERS,
                            { keyPath: "id" }
                        );
                    } else {
                        store = transaction.objectStore(
                            OFFLINE_STORES.ANSWERS
                        );
                    }

                    ensureIndex(store, "by-exam", "examId");
                    ensureIndex(store, "by-student", "studentId");
                    ensureIndex(store, "by-question", "questionId");
                    ensureIndex(
                        store,
                        "by-exam-student",
                        ["examId", "studentId"]
                    );
                    ensureIndex(store, "by-sync-status", "syncStatus");

                    /*
                     * PROCTOR EVENTS
                     */
                    if (!db.objectStoreNames.contains(OFFLINE_STORES.PROCTOR_EVENTS)) {
                        store = db.createObjectStore(
                            OFFLINE_STORES.PROCTOR_EVENTS,
                            { keyPath: "id" }
                        );
                    } else {
                        store = transaction.objectStore(
                            OFFLINE_STORES.PROCTOR_EVENTS
                        );
                    }

                    // Remove the incorrect old index.
                    removeIndex(store, "by-session");

                    ensureIndex(store, "by-exam", "examId");
                    ensureIndex(store, "by-student", "studentId");
                    ensureIndex(
                        store,
                        "by-exam-student",
                        ["examId", "studentId"]
                    );
                    ensureIndex(store, "by-sync-status", "syncStatus");
                    ensureIndex(store, "by-sequence", "sequenceNumber");

                    /*
                     * QUESTION REPORTS
                     */
                    if (!db.objectStoreNames.contains(OFFLINE_STORES.QUESTION_REPORTS)) {
                        store = db.createObjectStore(
                            OFFLINE_STORES.QUESTION_REPORTS,
                            { keyPath: "id" }
                        );
                    } else {
                        store = transaction.objectStore(
                            OFFLINE_STORES.QUESTION_REPORTS
                        );
                    }

                    ensureIndex(store, "by-exam", "examId");
                    ensureIndex(store, "by-student", "studentId");
                    ensureIndex(store, "by-question", "questionId");
                    ensureIndex(
                        store,
                        "by-exam-student",
                        ["examId", "studentId"]
                    );
                    ensureIndex(store, "by-sync-status", "syncStatus");

                    /*
                     * SYNC QUEUE
                     */
                    if (!db.objectStoreNames.contains(OFFLINE_STORES.SYNC_QUEUE)) {
                        store = db.createObjectStore(
                            OFFLINE_STORES.SYNC_QUEUE,
                            { keyPath: "id" }
                        );
                    } else {
                        store = transaction.objectStore(
                            OFFLINE_STORES.SYNC_QUEUE
                        );
                    }

                    ensureIndex(store, "by-exam", "examId");
                    ensureIndex(store, "by-student", "studentId");
                    ensureIndex(store, "by-type", "type");
                    ensureIndex(store, "by-status", "status");
                    ensureIndex(store, "by-created-at", "createdAt");

                    void oldVersion;
                    void newVersion;
                },
            }
        );
    }

    return dbPromise;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function createId(prefix: string): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return `${prefix}_${crypto.randomUUID()}`;
    }

    return `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
}

/* -------------------------------------------------------------------------- */
/* Exam Packages                                                              */
/* -------------------------------------------------------------------------- */

export async function saveExamPackage(
    examPackage: OfflineExamPackage
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.EXAM_PACKAGES,
        examPackage
    );
}

export async function getExamPackage(
    packageId: string
): Promise<OfflineExamPackage | undefined> {
    const db = await getOfflineDB();

    return db.get(
        OFFLINE_STORES.EXAM_PACKAGES,
        packageId
    );
}

export async function getExamPackageForStudent(
    examId: string,
    studentId: string
): Promise<OfflineExamPackage | undefined> {
    const db = await getOfflineDB();

    return db.getFromIndex(
        OFFLINE_STORES.EXAM_PACKAGES,
        "by-exam-student",
        [examId, studentId]
    );
}

export async function getOfflineExamPackageForExam(
    examId: string
) {
    const db = await getOfflineDB();

    return db.getFromIndex(
        OFFLINE_STORES.EXAM_PACKAGES,
        "by-exam",
        examId
    );
}

export async function deleteExamPackage(
    packageId: string
): Promise<void> {
    const db = await getOfflineDB();

    await db.delete(
        OFFLINE_STORES.EXAM_PACKAGES,
        packageId
    );
}

/* -------------------------------------------------------------------------- */
/* Exam Sessions                                                              */
/* -------------------------------------------------------------------------- */

export async function saveOfflineExamSession(
    session: OfflineExamSession
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.EXAM_SESSIONS,
        session
    );
}

export async function getOfflineExamSession(
    sessionId: string
): Promise<OfflineExamSession | undefined> {
    const db = await getOfflineDB();

    return db.get(
        OFFLINE_STORES.EXAM_SESSIONS,
        sessionId
    );
}

export async function getOfflineExamSessionForStudent(
    examId: string,
    studentId: string
): Promise<OfflineExamSession | undefined> {
    const db = await getOfflineDB();

    return db.getFromIndex(
        OFFLINE_STORES.EXAM_SESSIONS,
        "by-exam-student",
        [examId, studentId]
    );
}

export async function getOfflineExamSessionForExam(
    examId: string
) {
    const db = await getOfflineDB();

    return db.getFromIndex(
        OFFLINE_STORES.EXAM_SESSIONS,
        "by-exam",
        examId
    );
}

/* -------------------------------------------------------------------------- */
/* Answers                                                                    */
/* -------------------------------------------------------------------------- */

export async function saveOfflineAnswer(
    answer: OfflineAnswer
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.ANSWERS,
        answer
    );
}

export async function getOfflineAnswer(
    answerId: string
): Promise<OfflineAnswer | undefined> {
    const db = await getOfflineDB();

    return db.get(
        OFFLINE_STORES.ANSWERS,
        answerId
    );
}

export async function getOfflineAnswers(
    examId: string,
    studentId: string
): Promise<OfflineAnswer[]> {
    const db = await getOfflineDB();

    return db.getAllFromIndex(
        OFFLINE_STORES.ANSWERS,
        "by-exam-student",
        [examId, studentId]
    );
}

/* -------------------------------------------------------------------------- */
/* Proctor Events                                                             */
/* -------------------------------------------------------------------------- */

export async function saveOfflineProctorEvent(
    event: OfflineProctorEvent
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.PROCTOR_EVENTS,
        event
    );
}

export async function getOfflineProctorEvents(
    examId: string,
    studentId: string
): Promise<OfflineProctorEvent[]> {
    const db = await getOfflineDB();

    const events = await db.getAllFromIndex(
        OFFLINE_STORES.PROCTOR_EVENTS,
        "by-exam-student",
        [examId, studentId]
    );

    return events.sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber
    );
}

/* -------------------------------------------------------------------------- */
/* Question Reports                                                           */
/* -------------------------------------------------------------------------- */

export async function saveOfflineQuestionReport(
    report: OfflineQuestionReport
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.QUESTION_REPORTS,
        report
    );
}

export async function getOfflineQuestionReports(
    examId: string,
    studentId: string
): Promise<OfflineQuestionReport[]> {
    const db = await getOfflineDB();

    return db.getAllFromIndex(
        OFFLINE_STORES.QUESTION_REPORTS,
        "by-exam-student",
        [examId, studentId]
    );
}

/* -------------------------------------------------------------------------- */
/* Sync Queue                                                                 */
/* -------------------------------------------------------------------------- */

export async function addToOfflineSyncQueue(
    item: OfflineSyncQueueItem
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.SYNC_QUEUE,
        item
    );
}

export async function createOfflineSyncQueueItem(
    data: Omit<
        OfflineSyncQueueItem,
        "id" | "createdAt" | "attempts" | "status"
    >
): Promise<OfflineSyncQueueItem> {
    const item: OfflineSyncQueueItem = {
        ...data,
        id: createId("sync"),
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: "PENDING",
    };

    await addToOfflineSyncQueue(item);

    return item;
}

export async function getPendingOfflineSyncItems(
    examId?: string,
    studentId?: string
): Promise<OfflineSyncQueueItem[]> {
    const db = await getOfflineDB();

    const items = await db.getAllFromIndex(
        OFFLINE_STORES.SYNC_QUEUE,
        "by-status",
        "PENDING"
    );

    return items
        .filter((item) => {
            if (examId && item.examId !== examId) {
                return false;
            }

            if (studentId && item.studentId !== studentId) {
                return false;
            }

            return true;
        })
        .sort(
            (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
        );
}

export async function updateOfflineSyncQueueItem(
    item: OfflineSyncQueueItem
): Promise<void> {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.SYNC_QUEUE,
        item
    );
}

export async function deleteOfflineSyncQueueItem(
    itemId: string
): Promise<void> {
    const db = await getOfflineDB();

    await db.delete(
        OFFLINE_STORES.SYNC_QUEUE,
        itemId
    );
}

/* -------------------------------------------------------------------------- */
/* Convenience                                                                */
/* -------------------------------------------------------------------------- */

export function createOfflineAnswerId(
    examId: string,
    studentId: string,
    questionId: string
): string {
    return `answer_${examId}_${studentId}_${questionId}`;
}

export function createOfflineSessionId(
    examId: string,
    studentId: string
): string {
    return `session_${examId}_${studentId}`;
}

export function createOfflineProctorEventId(): string {
    return createId("event");
}

export function createOfflineQuestionReportId(): string {
    return createId("report");
}