/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Browser, chromium, LaunchOptions, Page} from "npm:playwright";
import {withTimeout} from "./withTimeout.ts";

// How long an idle form session is kept alive before its browser is closed.
// Generous because a human may be watching/solving a captcha between LLM calls.
const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// Playwright's close() calls normally settle in well under a second — bounding them
// guards against a wedged browser process hanging the caller (e.g. interactWithForm's
// error-path cleanup, which isn't itself wrapped in any timeout) forever.
const CLOSE_TIMEOUT_MS = 5_000;

type FormSession = {
    browser: Browser;
    page: Page;
    idleTimer: ReturnType<typeof setTimeout>;
};

// Keyed by form URL — the LLM is instructed to pass the same `url` on every
// call for a given form, so this lets multi-page (client-side-routed) forms
// keep their in-page navigation state across separate tool invocations
// instead of restarting from a fresh page load every time.
const sessions = new Map<string, FormSession>();

function scheduleExpiry (key: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
        closeSession(key);
    }, SESSION_IDLE_TIMEOUT_MS);
}

/** Closes and removes the session for `key`, if one exists. Safe to call repeatedly. */
export async function closeSession (key: string): Promise<void> {
    const session = sessions.get(key);

    if (!session) return;

    sessions.delete(key);
    clearTimeout(session.idleTimer);

    await withTimeout(session.page.close(), CLOSE_TIMEOUT_MS, "page.close timed out")
        .catch((err) => console.warn(`[FormInteraction] session close: ${err instanceof Error ? err.message : String(err)}`));
    await withTimeout(session.browser.close(), CLOSE_TIMEOUT_MS, "browser.close timed out")
        .catch((err) => console.warn(`[FormInteraction] session close: ${err instanceof Error ? err.message : String(err)}`));
}

/**
 * Closes every session whose key belongs to `sessionId` (i.e. keyed `${sessionId}:${url}`).
 * A single run can open sessions for several URLs (e.g. one per orchestrated agent task),
 * so this sweeps all of them at once instead of requiring the caller to track each url.
 */
export async function closeSessionsByPrefix (sessionId: string): Promise<void> {
    const prefix = `${sessionId}:`;
    const keys = Array.from(sessions.keys()).filter((key) => key.startsWith(prefix));

    await Promise.all(keys.map((key) => closeSession(key)));
}

/**
 * Returns the open page for `key`, reusing it (and resetting its idle timer)
 * when one is already alive, or launching a fresh browser + page otherwise
 * (including when a previous session for that key has crashed/closed).
 */
export async function getOrCreateSession (
    key: string,
    launchOptions: LaunchOptions
): Promise<{page: Page; isNew: boolean}> {
    const existing = sessions.get(key);

    if (existing && !existing.page.isClosed()) {
        clearTimeout(existing.idleTimer);
        existing.idleTimer = scheduleExpiry(key);

        return {page: existing.page, isNew: false};
    }

    if (existing) {
        await closeSession(key);
    }

    const browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();

    sessions.set(key, {browser, page, idleTimer: scheduleExpiry(key)});

    return {page, isNew: true};
}
