/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {launchBrowser} from "../../utils/browserUtils.ts";


export async function fetchRenderedHtml (url: string, browserPath?: string): Promise<string> {
    let content = "";

    try {
        await launchBrowser(
            {headless: false, executablePath: browserPath || undefined},
            async (page) => {
                await page.goto(url, {waitUntil: "load"});
                content = await page.content();
            },
            30_000
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`Failed to render HTML for ${url}: ${message}`);
    }

    return content;
}