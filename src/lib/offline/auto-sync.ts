import { syncOfflineData } from "./sync";

let syncInProgress = false;

export async function runOfflineSync(): Promise<void> {
    if (syncInProgress) {
        return;
    }

    syncInProgress = true;

    try {
        /*
         * Do not attempt synchronization while the browser
         * reports that there is no network connection.
         */
        if (
            typeof navigator !== "undefined" &&
            !navigator.onLine
        ) {
            return;
        }

        const result =
            await syncOfflineData();

        if (result.succeeded > 0) {
            console.info(
                `[Offline Sync] ${result.succeeded} item(s) synchronized successfully.`
            );
        }

        if (result.failed > 0) {
            console.warn(
                `[Offline Sync] ${result.failed} item(s) remain pending.`,
                result.errors
            );
        }
    } catch (error) {
        console.warn(
            "[Offline Sync] Synchronization attempt failed.",
            error
        );
    } finally {
        syncInProgress = false;
    }
}

export function startOfflineAutoSync(): () => void {
    if (typeof window === "undefined") {
        return () => { };
    }

    /*
     * Try once when the application starts.
     *
     * This handles the case where the student opens the
     * application while already connected to the internet.
     */
    void runOfflineSync();

    /*
     * Synchronize automatically whenever the browser
     * reports that connectivity has returned.
     */
    const handleOnline = () => {
        void runOfflineSync();
    };

    window.addEventListener(
        "online",
        handleOnline
    );

    /*
     * Return a cleanup function so React components
     * can remove the listener when they unmount.
     */
    return () => {
        window.removeEventListener(
            "online",
            handleOnline
        );
    };
}