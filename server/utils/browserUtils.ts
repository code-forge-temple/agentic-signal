import {Browser, chromium, LaunchOptions, Page} from "npm:playwright";

/**
 * Launches a Chromium browser, runs the callback with a new page, and closes everything after.
 * Pass `timeoutMs` to automatically reject if the callback takes too long, including the
 * browser launch itself (which can hang on Windows when stdio handles are invalid).
 * On a timeout the browser is closed too, so its window doesn't outlive the call.
 */
export async function launchBrowser<T> (
    options: LaunchOptions,
    callback: (page: Page) => Promise<T>,
    timeoutMs?: number
): Promise<T> {
    // Outside doWork so the timeout below can close the browser while the callback is still running.
    let browser: Browser | undefined;
    let timedOut = false;

    // The entire operation — launch + callback — is wrapped in a single timeout.
    // This is important because chromium.launch() itself can hang (e.g. EBADF on Windows
    // when Deno is spawned as a child process with piped stdio), which would leave the
    // caller's promise pending forever if only the callback were guarded.
    const doWork = async (): Promise<T> => {
        let page;

        try {
            browser = await chromium.launch(options);
            page = await browser.newPage();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            throw new Error(`Browser launch or page initialization failed: ${message}`);
        }

        if (timedOut) {
            // The launch outlasted the timeout, so there was no browser to close back then.
            await browser.close().catch(() => {});

            throw new Error("Browser launched after the operation had timed out");
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
            () => {
                timedOut = true;
                reject(new Error(`Browser operation timed out after ${timeoutMs / 1000}s`));
                // The callback's pending Playwright calls then fail with "Target closed",
                // but by then the race has already settled on the timeout error.
                browser?.close().catch(() => {});
            },
            timeoutMs
        );
    });

    try {
        return await Promise.race([doWork(), timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}
