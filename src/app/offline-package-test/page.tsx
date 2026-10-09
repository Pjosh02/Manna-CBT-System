"use client";

import { useEffect, useState } from "react";
import { testOfflineExamPackage } from "@/lib/offline/package-test";
import { testOfflineExamSession } from "@/lib/offline/session-test";
import { testOfflineAnswer } from "@/lib/offline/answer-test";
import { testOfflineProctorEvent } from "@/lib/offline/proctor-test";
import { testOfflineQuestionReport } from "@/lib/offline/report-test";
import { testOfflineAnswerSync } from "@/lib/offline/sync-test";
import { testOfflineSubmission } from "@/lib/offline/submit-test";
import { testOfflineSessionRecovery } from "@/lib/offline/session-recovery-test";
import {
    getOfflineTestExamId,
    setOfflineTestExamId,
} from "@/lib/offline/test-config";
import {
    testOfflineThirdTabSwitchSubmission,
} from "@/lib/offline/third-tab-switch-test";

export default function OfflinePackageTestPage() {
    const [status, setStatus] = useState(
        "Not tested yet."
    );

    const [testing, setTesting] = useState(false);

    const [selectedExamId, setSelectedExamId] =
        useState("");

    const [examIdSaved, setExamIdSaved] =
        useState(false);

    useEffect(() => {
        setSelectedExamId(
            getOfflineTestExamId()
        );
    }, []);

    async function runTest() {
        try {
            setTesting(true);

            if (!selectedExamId.trim()) {
                setStatus("Please enter and save an Exam ID first.");
                setTesting(false);
                return;
            }

            setStatus(
                "Downloading the selected offline exam package..."
            );

            const result =
                await testOfflineExamPackage(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE PACKAGE TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline exam package test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? `Test failed: ${error.message}`
                    : "Offline exam package test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runSessionTest() {
        try {
            setTesting(true);

            setStatus(
                "Creating offline exam session..."
            );

            const result =
                await testOfflineExamSession(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE SESSION TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline exam session test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? `Session test failed: ${error.message}`
                    : "Offline exam session test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runAnswerTest() {
        try {
            setTesting(true);

            setStatus(
                "Saving an offline answer..."
            );

            const result =
                await testOfflineAnswer(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE ANSWER TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline answer test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? `Answer test failed: ${error.message}`
                    : "Offline answer test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runProctorTest() {
        try {
            setTesting(true);

            setStatus(
                "Recording an offline TAB_SWITCH event..."
            );

            const result =
                await testOfflineProctorEvent(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE PROCTOR TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline proctor test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? `Proctor test failed: ${error.message}`
                    : "Offline proctor test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runReportTest() {
        try {
            setTesting(true);

            setStatus(
                "Saving an offline question report..."
            );

            const result =
                await testOfflineQuestionReport(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE QUESTION REPORT TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline question report test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? `Report test failed: ${error.message}`
                    : "Offline question report test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runSyncTest() {
        try {
            setTesting(true);

            setStatus(
                "Creating an offline answer and synchronizing it with the server..."
            );

            const result =
                await testOfflineAnswerSync(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE ANSWER SYNC TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline answer sync test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? error.message
                    : "Offline answer sync test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runSubmissionTest() {
        try {
            setTesting(true);

            setStatus(
                "Testing the offline submission pipeline using the SAFE rollback endpoint..."
            );

            const result =
                await testOfflineSubmission(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE SUBMISSION TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline submission test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? error.message
                    : "Offline submission test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    async function runSessionRecoveryTest() {
        try {
            setTesting(true);

            setStatus(
                "Recovering the offline exam session and calculating remaining time..."
            );

            const result =
                await testOfflineSessionRecovery(selectedExamId);

            setStatus(result.message);

            console.log(
                "OFFLINE SESSION RECOVERY TEST RESULT:",
                result
            );
        } catch (error) {
            console.error(
                "Offline session recovery test failed:",
                error
            );

            setStatus(
                error instanceof Error
                    ? error.message
                    : "Offline session recovery test failed."
            );
        } finally {
            setTesting(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-xl rounded-2xl border bg-white p-8 shadow-sm">
                <h1 className="text-2xl font-bold">
                    MANNA Offline Exam Package Test
                </h1>

                <p className="mt-3 text-gray-600">
                    This test downloads a frozen examination package
                    from the server and stores it in IndexedDB.
                </p>

                <div className="mt-6">
                    <label
                        htmlFor="offline-test-exam-id"
                        className="block text-sm font-semibold text-gray-700"
                    >
                        Exam ID
                    </label>

                    <input
                        id="offline-test-exam-id"
                        type="text"
                        value={selectedExamId}
                        onChange={(e) => {
                            setSelectedExamId(e.target.value);
                            setExamIdSaved(false);
                        }}
                        placeholder="Paste the exam ID here"
                        className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
                    />

                    <button
                        type="button"
                        onClick={() => {
                            try {
                                setOfflineTestExamId(selectedExamId);
                                setExamIdSaved(true);
                            } catch (error) {
                                alert(
                                    error instanceof Error
                                        ? error.message
                                        : "Failed to save exam ID."
                                );
                            }
                        }}
                        disabled={!selectedExamId.trim()}
                        className="mt-3 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        Use This Exam
                    </button>

                    {examIdSaved && (
                        <p className="mt-2 text-sm font-medium text-green-600">
                            Exam ID saved for offline testing.
                        </p>
                    )}
                </div>

                <p className="mt-3 text-sm text-gray-500">
                    The test does not submit the examination.
                </p>

                <button
                    onClick={runTest}
                    disabled={testing}
                    className="mt-6 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Downloading..."
                        : "Save Physics Package Offline"}
                </button>

                <button
                    onClick={runSessionTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Create Offline Exam Session"}
                </button>

                <button
                    onClick={runAnswerTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Save Offline Answer"}
                </button>

                <button
                    onClick={runProctorTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Test Offline Proctor Event"}
                </button>

                <button
                    onClick={runReportTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Test Offline Question Report"}
                </button>

                <button
                    onClick={runSyncTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Test Real Offline Answer Sync"}
                </button>

                <button
                    onClick={runSubmissionTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Test Safe Offline Submission"}
                </button>

                <button
                    onClick={runSessionRecoveryTest}
                    disabled={testing}
                    className="mt-3 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                    {testing
                        ? "Testing..."
                        : "Test Offline Session Recovery"}
                </button>

                <button
                    type="button"
                    onClick={async () => {
                        console.log(
                            "Third tab-switch test button clicked"
                        );

                        try {
                            const result =
                                await testOfflineThirdTabSwitchSubmission();

                            console.log(
                                "Third tab-switch test result:",
                                result
                            );

                            alert(
                                result.message +
                                "\n\nProcessed: " +
                                result.processed +
                                "\nSucceeded: " +
                                result.succeeded +
                                "\nFailed: " +
                                result.failed +
                                (
                                    result.errors.length > 0
                                        ? "\n\nErrors:\n" +
                                        result.errors.join("\n")
                                        : ""
                                )
                            );
                        } catch (error) {
                            console.error(
                                "Third tab-switch test failed:",
                                error
                            );

                            alert(
                                "Third tab-switch test failed:\n\n" +
                                (
                                    error instanceof Error
                                        ? error.message
                                        : String(error)
                                )
                            );
                        }
                    }}
                    style={{
                        width: "100%",
                        marginTop: "10px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#000",
                        color: "#fff",
                        fontSize: "15px",
                        fontWeight: "600",
                        cursor: "pointer",
                    }}
                >
                    Test Offline 3rd Tab Switch Auto-Submission
                </button>

                <div className="mt-6 rounded-lg bg-gray-100 p-4">
                    <strong>Status:</strong>

                    <p className="mt-2">
                        {status}
                    </p>
                </div>
            </div>
        </main>
    );
}