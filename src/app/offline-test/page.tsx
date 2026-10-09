"use client";

import { useState } from "react";
import { testOfflineDatabase } from "@/lib/offline/test";

export default function OfflineTestPage() {
    const [status, setStatus] = useState("Not tested yet.");
    const [testing, setTesting] = useState(false);

    async function runTest() {
        try {
            setTesting(true);
            setStatus("Testing offline database...");

            const result = await testOfflineDatabase();

            setStatus(result.message);
        } catch (error) {
            console.error("Offline database test failed:", error);

            setStatus(
                error instanceof Error
                    ? `Test failed: ${error.message}`
                    : "Offline database test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-2xl border bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold">
                    MANNA Offline Database Test
                </h1>

                <p className="mt-3 text-gray-600">
                    This page tests whether the browser can create, read, and delete
                    offline CBT data using IndexedDB.
                </p>

                <button
                    onClick={runTest}
                    disabled={testing}
                    className="mt-6 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing ? "Testing..." : "Test Offline Database"}
                </button>

                <div className="mt-6 rounded-lg bg-gray-100 p-4">
                    <strong>Status:</strong>
                    <p className="mt-2">{status}</p>
                </div>
            </div>
        </main>
    );
}