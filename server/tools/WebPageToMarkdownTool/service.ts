/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {Locator, Page} from "npm:playwright";
import {WebPageToMarkdownResult} from "./types.ts";
import {disguisedLaunchOptions, disguisePage, launchBrowser} from "../../utils/browserUtils.ts";
import TurndownService from "npm:turndown";
import {errorMessage} from "../../../shared/utils.ts";
import {consentLabelPattern, nextRedirectWaitMs} from "./utils.ts";

const PAGE_TIMEOUT_MS = 30_000;
// Budget for the whole operation (browser launch, navigation, consent and redirect
// handling). Kept well above PAGE_TIMEOUT_MS so a slow navigation doesn't leave
// the remaining steps with no time at all.
const TOTAL_TIMEOUT_MS = 60_000;

const CONSENT_SELECTORS = [
    "#L2AGLb", // Google "Accept all"
    "[jsname='b3VHJd']", // Google consent alternate
    "[aria-label='Accept all']",
    "[aria-label='Agree to all']",
];
const CONSENT_TEXT_LABELS = ["Accept all", "Agree to all", "I agree", "Agree"];
// How long a consent button may take to show up after the page loaded.
const CONSENT_WAIT_MS = 500;
// A banner can animate away or get covered after it showed: then the page is read as it is.
const CONSENT_CLICK_TIMEOUT_MS = 5_000;

type BrowserExtractedContent = {
    title: string;
    content: string;
    excerpt: string;
};

async function openPage (page: Page, url: string): Promise<void> {
    // "domcontentloaded" rather than "load": shop pages full of trackers and ads can
    // miss the "load" event entirely even though their content is already there.
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS});
    await page.waitForLoadState("load", {timeout: 10_000}).catch(() => {});
}

/**
 * Follows any redirect chain until the URL has been stable for 3s, capped at a 20s total budget. This handles
 * multi-hop chains (e.g. consent.google.com → news.google.com → publisher) without hardcoding any domain names.
 */
async function followRedirects (page: Page): Promise<void> {
    const deadline = Date.now() + 20_000;
    let lastUrl = page.url();

    for (let timeout = nextRedirectWaitMs(deadline, Date.now()); timeout !== null; timeout = nextRedirectWaitMs(deadline, Date.now())) {
        const changed = await page.waitForURL((u: URL) => u.href !== lastUrl, {timeout}).then(() => true).catch(() => false);

        if (!changed) break;

        await page.waitForLoadState("load", {timeout: 8_000}).catch(() => {});

        lastUrl = page.url();
    }
}

/**
 * The first of `locators` that's visible, in their order. All are waited for at once, so a button that shows up a
 * moment after the page loaded still counts, and the wait is CONSENT_WAIT_MS at most rather than that times N.
 */
async function firstVisible (locators: Locator[]): Promise<Locator | undefined> {
    const visible = await Promise.all(locators.map(locator => locator.waitFor({state: "visible", timeout: CONSENT_WAIT_MS}).then(() => true, () => false)));

    return locators[visible.indexOf(true)];
}

/**
 * Clicks a consent wall's accept button, by its known selectors first, then by its label. False when there's none, or
 * when the click didn't go through.
 */
async function dismissConsent (page: Page): Promise<boolean> {
    // One wait for both kinds; a known selector still wins over a label, being earlier in the list. Only visible
    // matches count: a hidden one earlier on the page (say in a closed "manage options" panel) must not hide the one
    // that shows.
    const button = await firstVisible([
        ...CONSENT_SELECTORS.map(selector => page.locator(selector).filter({visible: true}).first()),
        ...CONSENT_TEXT_LABELS.map(label => page.getByRole("button", {name: consentLabelPattern(label)}).filter({visible: true}).first()),
    ]);

    if (!button) return false;

    return button.click({timeout: CONSENT_CLICK_TIMEOUT_MS}).then(() => true, () => false);
}

/** Runs in the page: its main content, with the noise taken out first, plus its title and description. */
function readMainContent (): BrowserExtractedContent {
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
}

/** Opens the page and gets past what stands before its content: consent walls and the redirects after them. */
async function readPage (page: Page, url: string): Promise<BrowserExtractedContent> {
    await disguisePage(page);
    await openPage(page, url);

    // Two passes: consent walls can appear before the redirect (Google)
    // or after it (some publisher sites).
    for (let pass = 0; pass < 2; pass++) {
        if (await dismissConsent(page)) {
            await followRedirects(page);
        }
    }

    // Extract content using browser-native DOM — no jsdom needed.
    return page.evaluate(readMainContent);
}

function toMarkdown ({title, content, excerpt}: BrowserExtractedContent, url: string): WebPageToMarkdownResult {
    const TurndownClass = (TurndownService as any).default ?? TurndownService;
    const turndown = new TurndownClass({headingStyle: "atx", codeBlockStyle: "fenced"});

    return {
        title,
        url,
        content: turndown.turndown(content),
        excerpt,
    };
}

export async function fetchWebPageAsMarkdown (url: string, browserPath?: string): Promise<WebPageToMarkdownResult> {
    let extracted: BrowserExtractedContent = {title: "", content: "", excerpt: ""};

    try {
        await launchBrowser(disguisedLaunchOptions(browserPath), async (page) => {
            extracted = await readPage(page, url);
        }, TOTAL_TIMEOUT_MS);
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

    return toMarkdown(extracted, url);
}
