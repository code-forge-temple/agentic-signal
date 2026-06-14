import {chromium, LaunchOptions, Page} from "npm:playwright";

/**
 * Launches a Chromium browser, runs the callback with a new page, and closes everything after.
 * Pass `timeoutMs` to automatically reject if the callback takes too long, including the
 * browser launch itself (which can hang on Windows when stdio handles are invalid).
 */
export async function launchBrowser<T> (
    options: LaunchOptions,
    callback: (page: Page) => Promise<T>,
    timeoutMs?: number
): Promise<T> {
    // The entire operation — launch + callback — is wrapped in a single timeout.
    // This is important because chromium.launch() itself can hang (e.g. EBADF on Windows
    // when Deno is spawned as a child process with piped stdio), which would leave the
    // caller's promise pending forever if only the callback were guarded.
    const doWork = async (): Promise<T> => {
        let browser;
        let page;

        try {
            browser = await chromium.launch(options);
            page = await browser.newPage();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            throw new Error(`Browser launch or page initialization failed: ${message}`);
        }

        try {
            return await callback(page);
        } finally {
            if (page) {
                try {
                    await page.close();
                } catch {
                    // Ignore failures during cleanup.
                }
            }

            if (browser) {
                try {
                    await browser.close();
                } catch {
                    // Ignore cleanup failures when browser launch already failed.
                }
            }
        }
    };

    if (timeoutMs === undefined) {
        return doWork();
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`Browser operation timed out after ${timeoutMs / 1000}s`)),
            timeoutMs
        );
    });

    try {
        return await Promise.race([doWork(), timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}
