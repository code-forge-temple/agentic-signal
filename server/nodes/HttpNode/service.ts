/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {chromium, LaunchOptions, Page} from "npm:playwright";
import { launchBrowser } from "../../utils/browserUtils.ts";


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