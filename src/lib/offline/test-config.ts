const DEFAULT_OFFLINE_TEST_EXAM_ID =
    "2b3cd91f-f326-47ed-9881-62b97e39cb14";

const OFFLINE_TEST_EXAM_KEY =
    "manna_offline_test_exam_id";

export function getOfflineTestExamId(): string {
    if (typeof window !== "undefined") {
        const storedExamId =
            localStorage.getItem(OFFLINE_TEST_EXAM_KEY)?.trim();

        if (storedExamId) {
            return storedExamId;
        }
    }

    return DEFAULT_OFFLINE_TEST_EXAM_ID;
}

export function setOfflineTestExamId(
    examId: string
): void {
    const normalizedExamId = examId.trim();

    if (!normalizedExamId) {
        throw new Error("Exam ID is required.");
    }

    localStorage.setItem(
        OFFLINE_TEST_EXAM_KEY,
        normalizedExamId
    );
}

export function clearOfflineTestExamId(): void {
    localStorage.removeItem(
        OFFLINE_TEST_EXAM_KEY
    );
}