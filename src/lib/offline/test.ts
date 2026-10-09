import { getOfflineDB } from "./db";

const TEST_RECORD_ID = "offline-db-test";

export async function testOfflineDatabase() {
    const db = await getOfflineDB();

    const testSession = {
        id: TEST_RECORD_ID,
        examId: "test-exam",
        studentId: "test-student",
        packageId: "test-package",
        status: "READY" as const,
        startedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        submittedAt: null,
        tabSwitches: 0,
        syncStatus: "PENDING" as const,
        lastSyncAttemptAt: null,
        syncError: null,
    };

    await db.put("examSessions", testSession);

    const saved = await db.get("examSessions", TEST_RECORD_ID);

    if (!saved) {
        throw new Error("Offline database test failed: record was not saved.");
    }

    await db.delete("examSessions", TEST_RECORD_ID);

    const deleted = await db.get("examSessions", TEST_RECORD_ID);

    if (deleted) {
        throw new Error("Offline database test failed: record was not deleted.");
    }


    return {
        success: true,
        message: "MANNA offline database is working correctly.",
    };
}