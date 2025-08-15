/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {chromium} from "npm:playwright";
import {DuckDuckGoResult} from "../graphql/types.ts";

export async function fetchRenderedHtml (url: string): Promise<string> {
    const browser = await chromium.launch({headless: false});
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    await page.goto(url, {waitUntil: "load"});

    const content = await page.content();

    await browser.close();

    return content;
}

export async function fetchDuckDuckGoResults (query: string): Promise<DuckDuckGoResult[]> {
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=us-en&kp=-1&ia=web&kd=-1`;
    const browser = await chromium.launch({headless: false});
    const page = await browser.newPage();

    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    });

    await page.goto(url, {waitUntil: "domcontentloaded"});
    await page.waitForSelector("section > ol > li > article", {timeout: 5000});

    const results = await page.evaluate((): DuckDuckGoResult[] => {
        const articles = Array.from(document.querySelectorAll("section > ol > li > article"));

        return articles.map(article => {
            const divs = article.querySelectorAll(":scope > div");
            const sourceAndUrl = (divs[1] as HTMLElement)?.innerText || "";
            const title = (divs[2] as HTMLElement)?.innerText || "";
            const description = (divs[3] as HTMLElement)?.innerText || "";
            const url = divs[1]?.querySelector("a")?.href || "";

            return {
                sourceAndUrl,
                title,
                description,
                url
            };
        });
    });

    await browser.close();

    return results;
}