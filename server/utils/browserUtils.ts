import {Browser, BrowserContext, chromium, LaunchOptions, Page} from "npm:playwright";


// The window's size once restored from the taskbar: a 1280×800 page in Chrome's frame on Windows.
const WINDOW_SIZE = {width: 1296, height: 888};
const PAGE_OPEN_TIMEOUT_MS = 10_000;
// Where the window is made: far off-screen, so the moment Chrome shows it before minimizing it happens out of sight.
const OFF_SCREEN = -32_000;
// Restored from the taskbar, the window would come back off-screen, where it was made; it's moved here instead.
const ON_SCREEN = {left: 80, top: 80};
const RESTORE_CHECK_MS = 500;

/**
 * Keeps the page drawing while its window is minimized. Chrome then draws about one frame a second, and Playwright
 * waits for two frames before each click, check or hover, so each would take about 2 s. A screencast makes Chrome
 * draw as if the window were shown; its frames are tiny and dropped.
 */
async function keepDrawing (page: Page): Promise<void> {
    const session = await page.context().newCDPSession(page);

    // Chrome sends the next frame only once the last one is acknowledged.
    session.on("Page.screencastFrame", ({sessionId}) => {
        session.send("Page.screencastFrameAck", {sessionId}).catch(() => {});
    });
    // Left attached for the page's life: detaching ends the screencast.
    await session.send("Page.startScreencast", {format: "jpeg", quality: 1, maxWidth: 64, maxHeight: 64});
}

/** Keeps an eye on the page's window: once the user restores it from the taskbar, it's moved onto the screen. */
async function bringOnScreenWhenRestored (page: Page): Promise<void> {
    const session = await page.context().newCDPSession(page);
    const {windowId} = await session.send("Browser.getWindowForTarget");
    let checking = false;

    const timer = setInterval(() => {
        if (checking) return;

        checking = true;
        session.send("Browser.getWindowBounds", {windowId})
            .then(async ({bounds}) => {
                if (bounds.windowState === "normal" && (bounds.left ?? 0) < OFF_SCREEN / 2) {
                    await session.send("Browser.setWindowBounds", {windowId, bounds: ON_SCREEN});
                }
            })
            // The page or the browser is gone.
            .catch(() => clearInterval(timer))
            .finally(() => {
                checking = false;
            });
    }, RESTORE_CHECK_MS);

    // It never keeps the backend running on its own.
    Deno.unrefTimer(timer);
    page.once("close", () => clearInterval(timer));
}

/**
 * A new page whose window opens minimized: it waits in the taskbar, where the user can open it to watch, and doesn't
 * pull them away from what they're doing. Playwright's own `newPage()` opens a normal window, and minimizing it
 * afterwards still takes the focus for about a second, so the page is created through CDP already minimized.
 *
 * Its context has no viewport: Playwright would otherwise resize the window to fit one, which restores it. For the
 * same reason, give the page a size with `setPageSize`, not `page.setViewportSize`.
 *
 * If Chrome doesn't go along, the page opens in a normal window rather than failing the caller.
 */
export async function newMinimizedPage (browser: Browser): Promise<Page> {
    let context: BrowserContext | undefined;

    try {
        const session = await browser.newBrowserCDPSession();

        try {
            // Each launch has a browser of its own, so the one new context id is this one.
            const before = new Set((await session.send("Target.getBrowserContexts")).browserContextIds);

            context = await browser.newContext({viewport: null});

            const browserContextId = (await session.send("Target.getBrowserContexts")).browserContextIds.find(id => !before.has(id));

            if (!browserContextId) throw new Error("the new browser context wasn't found");

            const opened = context.waitForEvent("page", {timeout: PAGE_OPEN_TIMEOUT_MS});

            // When a step below fails first, nothing awaits it, and its rejection would be logged as unhandled.
            opened.catch(() => {});

            await session.send("Target.createTarget", {
                url: "about:blank",
                browserContextId,
                newWindow: true,
                windowState: "minimized",
                left: OFF_SCREEN,
                top: OFF_SCREEN,
                ...WINDOW_SIZE,
            });

            const page = await opened;

            // Without these the page still works: clicks are just slower, and the window can't be watched.
            await Promise.all([keepDrawing(page).catch(() => {}), bringOnScreenWhenRestored(page).catch(() => {})]);

            return page;
        } finally {
            await session.detach().catch(() => {});
        }
    } catch (error) {
        console.warn(`Couldn't open the browser minimized, so it opens normally: ${error instanceof Error ? error.message : String(error)}`);
        await context?.close().catch(() => {});

        return await browser.newPage();
    }
}

/**
 * Lays the page out at `size`, leaving its window alone. In a visible browser, `page.setViewportSize` also resizes
 * the window, which would bring a minimized one back.
 */
export async function setPageSize (page: Page, size: {width: number; height: number}): Promise<void> {
    // Left attached: Chrome drops the override when the session that set it detaches. It ends with the page.
    const session = await page.context().newCDPSession(page);

    await session.send("Emulation.setDeviceMetricsOverride", {...size, deviceScaleFactor: 0, mobile: false});
}

/**
 * Launches a Chromium browser, runs the callback with a new page (in a minimized window, see `newMinimizedPage`), and
 * closes everything after.
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
            page = await newMinimizedPage(browser);
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
