import {chromium, LaunchOptions, Page} from "npm:playwright";

/**
 * Launches a Chromium browser, runs the callback with a new page, and closes everything after.
 */
export async function launchBrowser<T> (
    options: LaunchOptions,
    callback: (page: Page) => Promise<T>
): Promise<T> {
    const browser = await chromium.launch(options);
    const page = await browser.newPage();

    try {
        return await callback(page);
    } finally {
        await page.close();
        await browser.close();
    }
}