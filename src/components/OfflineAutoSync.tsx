"use client";

import { useEffect } from "react";
import { startOfflineAutoSync } from "@/lib/offline/auto-sync";

export default function OfflineAutoSync() {
    useEffect(() => {
        const cleanup =
            startOfflineAutoSync();

        return cleanup;
    }, []);

    return null;
}