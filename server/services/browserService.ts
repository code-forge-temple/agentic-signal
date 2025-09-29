/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {chromium, LaunchOptions, Page} from "npm:playwright";
import {DuckDuckGoResult} from "../graphql/types.ts";
import {isObject} from "../../shared/utils.ts";


async function launchBrowser (
    options: LaunchOptions,
    callback: (page: Page) => Promise<void>
): Promise<void> {
    let lastError: unknown;

    for (const [launcher, userAgent] of [
        [chromium, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
    ] as const) {

        try {
            const browser = await launcher.launch(options);
            const context = await browser.newContext({userAgent});
            const page = await context.newPage();

            try {
                await callback(page);
            } finally {
                await browser.close();
            }

            return;
        } catch (err) {
            lastError = err;
        }
    }

    console.error(`[launchBrowser] All browser launch attempts failed. Last error:`, lastError);

    throw new Error(
        "Failed to launch browser: " + (isObject(lastError) && "message" in lastError ? lastError.message : String(lastError))
    );
}

export async function fetchRenderedHtml (url: string, browserPath?: string): Promise<string> {
    let content = "";

    await launchBrowser(
        {headless: false, executablePath: browserPath},
        async (page) => {
            await page.goto(url, {waitUntil: "load"});

            content = await page.content();
        }
    );

    return content;
}

export async function fetchDuckDuckGoResults (query: string, browserPath?: string): Promise<DuckDuckGoResult[]> {
    let results: DuckDuckGoResult[] = [];
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=us-en&kp=-1&ia=web&kd=-1`;

    await launchBrowser(
        {headless: false, executablePath: browserPath},
        async (page) => {
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            });

            await page.goto(url, {waitUntil: "domcontentloaded"});
            await page.waitForSelector("section > ol > li > article", {timeout: 5000});

            results = await page.evaluate((): DuckDuckGoResult[] => {
                const articles = Array.from(document.querySelectorAll("section > ol > li > article"));

                return articles.map(article => {
                    const divs = article.querySelectorAll(":scope > div");
                    const sourceAndUrl = (divs[1] as HTMLElement)?.innerText || "";
                    const title = (divs[2] as HTMLElement)?.innerText || "";
                    const description = (divs[3] as HTMLElement)?.innerText || "";
                    const url = divs[1]?.querySelector("a")?.href || "";

                    return {sourceAndUrl, title, description, url};
                });
            });
        }
    );

    return results;
}