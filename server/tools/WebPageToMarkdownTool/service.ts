/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {WebPageToMarkdownResult} from "./types.ts";
import {launchBrowser, setPageSize} from "../../utils/browserUtils.ts";
import TurndownService from "npm:turndown";
import {errorMessage} from "../../../shared/utils.ts";

const PAGE_TIMEOUT_MS = 30_000;
// Budget for the whole operation (browser launch, navigation, consent and redirect
// handling). Kept well above PAGE_TIMEOUT_MS so a slow navigation doesn't leave
// the remaining steps with no time at all.
const TOTAL_TIMEOUT_MS = 60_000;

type BrowserExtractedContent = {
    title: string;
    content: string;
    excerpt: string;
};

export async function fetchWebPageAsMarkdown (url: string, browserPath?: string): Promise<WebPageToMarkdownResult> {
    let extracted: BrowserExtractedContent = {title: "", content: "", excerpt: ""};

    try {
        await launchBrowser(
            {
                headless: false,
                executablePath: browserPath || undefined,
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
            },
            async (page) => {
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, "webdriver", {get: () => undefined});

                    // @ts-expect-error — inject chrome API stub present in real browsers
                    window.chrome = {runtime: {}};

                    Object.defineProperty(navigator, "plugins", {get: () => [1, 2, 3]});
                    Object.defineProperty(navigator, "languages", {get: () => ["en-US", "en"]});
                });

                await page.setExtraHTTPHeaders({
                    "Accept-Language": "en-US,en;q=0.9",
                });

                await setPageSize(page, {width: 1280, height: 800});

                // "domcontentloaded" rather than "load": shop pages full of trackers and ads can
                // miss the "load" event entirely even though their content is already there.
                await page.goto(url, {waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS});
                await page.waitForLoadState("load", {timeout: 10_000}).catch(() => {});

                // ------------------------------------------------------------------
                // Consent wall dismissal + generic redirect-chain following
                // ------------------------------------------------------------------
                const consentSelectors = [
                    "#L2AGLb", // Google "Accept all"
                    "[jsname='b3VHJd']", // Google consent alternate
                    "[aria-label='Accept all']",
                    "[aria-label='Agree to all']",
                ];
                const consentTextLabels = ["Accept all", "Accept All", "Agree to all", "I agree", "Agree"];

                // Follow any redirect chain until the URL has been stable for 3s,
                // capped at a 20s total budget. This handles multi-hop chains
                // (e.g. consent.google.com → news.google.com → publisher) without
                // hardcoding any domain names.
                const followRedirects = async () => {
                    const STABLE_MS = 3_000;
                    const deadline = Date.now() + 20_000;
                    let lastUrl = page.url();

                    while (Date.now() < deadline) {
                        const changed = await page.waitForURL(
                            (u: URL) => u.href !== lastUrl,
                            {timeout: Math.min(STABLE_MS, deadline - Date.now())}
                        ).then(() => true).catch(() => false);

                        if (!changed) break;

                        await page.waitForLoadState("load", {timeout: 8_000}).catch(() => {});

                        lastUrl = page.url();
                    }
                };

                // Check all consent button candidates in parallel so we waste at most
                // one tick (500 ms) rather than 500 ms × N when nothing is present.
                const dismissConsent = async (): Promise<boolean> => {
                    const selectorChecks = await Promise.all(
                        consentSelectors.map(sel =>
                            page.locator(sel).first()
                                .isVisible({timeout: 500})
                                .then(v => ({sel, v}))
                                .catch(() => ({sel, v: false}))
                        )
                    );
                    const csMatch = selectorChecks.find(r => r.v);

                    if (csMatch) {
                        await page.locator(csMatch.sel).first().click();

                        return true;
                    }

                    const textChecks = await Promise.all(
                        consentTextLabels.map(label =>
                            page.getByRole("button", {name: label, exact: false}).first()
                                .isVisible({timeout: 500})
                                .then(v => ({label, v}))
                                .catch(() => ({label, v: false}))
                        )
                    );
                    const txtMatch = textChecks.find(r => r.v);

                    if (txtMatch) {
                        await page.getByRole("button", {name: txtMatch.label, exact: false}).first().click();

                        return true;
                    }

                    return false;
                };

                // Two passes: consent walls can appear before the redirect (Google)
                // or after it (some publisher sites).
                for (let pass = 0; pass < 2; pass++) {
                    if (await dismissConsent()) {
                        await followRedirects();
                    }
                }

                // Extract content using browser-native DOM — no jsdom needed.
                extracted = await page.evaluate((): BrowserExtractedContent => {
                    // Remove noise elements (including images — stripped at DOM level
                    // to avoid base64 data: blobs polluting the markdown output).
                    const noiseSelectors = [
                        "script", "style", "nav", "header", "footer", "aside",
                        "iframe", "noscript", "form", "img", "picture", "svg",
                        "[role='banner']",
                        "[role='navigation']", "[role='complementary']", "[role='contentinfo']",
                    ];

                    noiseSelectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => el.remove());
                    });

                    // Prefer semantic content containers
                    const contentSelectors = [
                        "article", "main", "[role='main']",
                        ".post-content", ".article-content", ".entry-content",
                        ".story-body", ".article-body", ".post-body",
                        ".content", "#content", "#main",
                    ];

                    let contentEl: Element | null = null;

                    for (const sel of contentSelectors) {
                        contentEl = document.querySelector(sel);

                        if (contentEl) break;
                    }

                    if (!contentEl) contentEl = document.body;

                    const metaDesc = document.querySelector<HTMLMetaElement>(
                        'meta[name="description"], meta[property="og:description"]'
                    );

                    return {
                        title: document.title || "",
                        content: (contentEl as HTMLElement).innerHTML || "",
                        excerpt: metaDesc?.content || "",
                    };
                });
            },
            TOTAL_TIMEOUT_MS
        );
    } catch (error) {
        const message = errorMessage(error);

        // Playwright appends a multi-line call log to its messages. The full text stays in
        // the server log; the caller (and so the LLM) gets only the first line. No URL in
        // the thrown message: the resolver pairs every error with its URL.
        console.error(`[WebPageToMarkdown] ✗ ${url}: ${message}`);

        throw new Error(`Failed to fetch web page: ${message.split("\n")[0]}`);
    }

    if (!extracted.content) {
        throw new Error("Could not extract content from the page");
    }

    const TurndownClass = (TurndownService as any).default ?? TurndownService;
    const turndown = new TurndownClass({headingStyle: "atx", codeBlockStyle: "fenced"});

    const content = turndown.turndown(extracted.content);

    return {
        title: extracted.title,
        url,
        content,
        excerpt: extracted.excerpt,
    };
}
