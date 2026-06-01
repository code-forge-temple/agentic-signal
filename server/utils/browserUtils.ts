import {chromium, LaunchOptions, Page} from "npm:playwright";

/**
 * Launches a Chromium browser, runs the callback with a new page, and closes everything after.
 */
export async function launchBrowser<T> (
    options: LaunchOptions,
    callback: (page: Page) => Promise<T>
): Promise<T> {
    let browser;
    let page;

    try {
        browser = await chromium.launch(options);
        page = await browser.newPage();

        return await callback(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`Browser launch or page initialization failed: ${message}`);
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (_error) {
                // Ignore failures during cleanup.
            }
        }

        if (browser) {
            try {
                await browser.close();
            } catch (_error) {
                // Ignore cleanup failures when browser launch already failed.
            }
        }
    }
}