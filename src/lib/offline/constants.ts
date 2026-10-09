export const OFFLINE_DB_NAME = "manna-cbt-offline";

export const OFFLINE_DB_VERSION = 3;

export const OFFLINE_STORES = {
    EXAM_PACKAGES: "examPackages",
    EXAM_SESSIONS: "examSessions",
    ANSWERS: "answers",
    PROCTOR_EVENTS: "proctorEvents",
    QUESTION_REPORTS: "questionReports",
    SYNC_QUEUE: "syncQueue",
} as const;

export const OFFLINE_EXAM_STATUS = {
    READY: "READY",
    IN_PROGRESS: "IN_PROGRESS",
    SUBMITTED_LOCALLY: "SUBMITTED_LOCALLY",
    SYNC_PENDING: "SYNC_PENDING",
    SYNCED: "SYNCED",
} as const;

export const OFFLINE_SYNC_STATUS = {
    PENDING: "PENDING",
    SYNCING: "SYNCING",
    SYNCED: "SYNCED",
    FAILED: "FAILED",
} as const;