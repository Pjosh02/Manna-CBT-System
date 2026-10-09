import { getOfflineDB } from "./db";
import { OFFLINE_STORES } from "./constants";

import type { OfflineExamPackage } from "./types";

export async function saveOfflineExamPackage(
    examPackage: OfflineExamPackage
) {
    const db = await getOfflineDB();

    await db.put(
        OFFLINE_STORES.EXAM_PACKAGES,
        examPackage
    );

    return examPackage;
}

export async function getOfflineExamPackage(
    packageId: string
): Promise<OfflineExamPackage | undefined> {
    const db = await getOfflineDB();

    return db.get(
        OFFLINE_STORES.EXAM_PACKAGES,
        packageId
    );
}

export async function getOfflineExamPackageForExam(
    examId: string
): Promise<OfflineExamPackage | undefined> {
    const db = await getOfflineDB();

    const packages = await db.getAllFromIndex(
        OFFLINE_STORES.EXAM_PACKAGES,
        "by-exam",
        examId
    );

    return packages[0];
}

export async function deleteOfflineExamPackage(
    packageId: string
) {
    const db = await getOfflineDB();

    await db.delete(
        OFFLINE_STORES.EXAM_PACKAGES,
        packageId
    );
}

export async function hasOfflineExamPackage(
    examId: string
): Promise<boolean> {
    const examPackage =
        await getOfflineExamPackageForExam(examId);

    return Boolean(examPackage);
}