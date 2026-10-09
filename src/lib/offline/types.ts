export type OfflineExamStatus =
    | "READY"
    | "IN_PROGRESS"
    | "SUBMITTED_LOCALLY"
    | "SYNC_PENDING"
    | "SYNCED";

export type OfflineSyncStatus =
    | "PENDING"
    | "SYNCING"
    | "SYNCED"
    | "FAILED";

export type OfflineEventType =
    | "TAB_SWITCH"
    | "BLUR"
    | "FOCUS"
    | "FULLSCREEN_EXIT"
    | "QUESTION_REPORT"
    | "EXAM_STARTED"
    | "EXAM_SUBMITTED";

export interface OfflineExamQuestion {
    id: string;
    subjectId: string;
    questionText: string;
    imageUrl?: string | null;
    passageText?: string | null;
    passageTitle?: string | null;

    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    optionE?: string | null;
    optionF?: string | null;

    questionType: string;
    instruction?: string | null;
    points?: number;
    sequenceNumber?: number;
}

export interface OfflineExamSubject {
    subjectId: string;
    subjectName: string;
    numberOfQuestions: number;
    questions: OfflineExamQuestion[];
}

export interface OfflineExamPackage {
    id: string;
    examId: string;
    studentId: string;

    examTitle: string;
    durationMinutes: number;
    startTime: string;
    endTime: string;

    assessmentType: string;

    packageVersion: number;

    // Server-issued frozen snapshot identity.
    snapshotId: string;
    snapshotHash?: string;
    frozenAt: string;

    subjects: OfflineExamSubject[];

    downloadedAt: string;
    expiresAt?: string | null;
}

export interface OfflineAnswer {
    id: string;
    examId: string;
    studentId: string;
    questionId: string;
    subjectId: string;

    selectedOption: string | null;
    isFlagged: boolean;

    answeredAt: string;
    syncStatus: OfflineSyncStatus;
}

export interface OfflineProctorEvent {
    id: string;
    examId: string;
    studentId: string;

    type: OfflineEventType;

    timestamp: string;
    sequenceNumber: number;

    metadata?: Record<string, unknown>;
    syncStatus: OfflineSyncStatus;
}

export interface OfflineQuestionReport {
    id: string;
    examId: string;
    studentId: string;
    questionId: string;

    reason: string;

    createdAt: string;
    syncStatus: OfflineSyncStatus;
}

export interface OfflineExamSession {
    id: string;

    examId: string;
    studentId: string;

    packageId: string;

    status: OfflineExamStatus;

    startedAt: string;
    deadline: string;

    submittedAt?: string | null;

    tabSwitches: number;

    syncStatus: OfflineSyncStatus;

    lastSyncAttemptAt?: string | null;
    syncError?: string | null;
}

export interface OfflineSyncQueueItem {
    id: string;

    examId: string;
    studentId: string;

    type:
    | "ANSWER"
    | "QUESTION_REPORT"
    | "PROCTOR_EVENT"
    | "SUBMIT_EXAM";

    payload: unknown;

    createdAt: string;

    attempts: number;

    status: OfflineSyncStatus;

    lastAttemptAt?: string | null;
    error?: string | null;
}