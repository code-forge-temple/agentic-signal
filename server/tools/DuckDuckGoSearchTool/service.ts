/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {DuckDuckGoResult} from "./types.ts";
import {chromium, LaunchOptions, Page} from "npm:playwright";
import {launchBrowser} from "../../utils/browserUtils.ts";


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