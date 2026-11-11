/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Locator, Page} from "npm:playwright";
import {FillAction} from "../types.ts";

export const ACTION_TIMEOUT_MS = 8_000;

// Inputs Playwright's fill() parses natively (a date, a number…); typed character by character they don't work well.
const NATIVE_FILL_TYPES = ["date", "datetime-local", "month", "week", "time", "number", "range"];

/** One action as it runs: the page, the element it targets, and what the call brought along. */
type ActionRun = {
    page: Page;
    locator: Locator;
    action: FillAction;
    attachedFilePathMap: Record<string, string>;
    typingDelay: number;
};

/** The kind of field: "contenteditable", an input's type, or else its tag name; "text" when it can't be told. */
const fieldKind = (locator: Locator): Promise<string> => locator
    .evaluate((el: Element) => {
        if (el.getAttribute("contenteditable") === "true") return "contenteditable";

        return (el as HTMLInputElement).type || el.tagName.toLowerCase();
    })
    .catch(() => "text");

/** `value` with real newlines, returns and tabs where some models send them double-escaped (the two-char literal '\n'). */
export const unescaped = (value: string) => value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");

/**
 * Types `value` character by character at the typing delay's pace, pressing Enter for actual newlines so textarea and
 * contenteditable get proper line breaks.
 */
async function typeLikeAPerson ({page, locator, typingDelay}: ActionRun, value: string): Promise<void> {
    const segments = unescaped(value).split("\n");
    // Per-character delay: typingDelay × 80ms base, ±50% jitter.
    const delay = Math.max(10, Math.floor(typingDelay * 80 * (0.5 + Math.random())));
    // Playwright's default action timeout (30s) covers the WHOLE call, including every inter-keystroke delay — a long
    // value at a human-like pace can legitimately take longer than that. The timeout is sized to the expected typing
    // duration (plus a safety margin) instead of racing the default.
    const typeText = (text: string) => locator.pressSequentially(text, {delay, timeout: Math.max(ACTION_TIMEOUT_MS, text.length * delay + 10_000)});

    for (let s = 0; s < segments.length; s++) {
        if (segments[s].length > 0) await typeText(segments[s]);

        if (s < segments.length - 1) await page.keyboard.press("Enter");
    }
}

async function fillField (run: ActionRun): Promise<void> {
    const {locator, action, typingDelay} = run;
    const useNativeFill = NATIVE_FILL_TYPES.includes(await fieldKind(locator));

    if (useNativeFill || typingDelay <= 0) {
        // Instant mode or special input type: set value directly.
        await locator.fill(action.value ?? "", {timeout: ACTION_TIMEOUT_MS});

        return;
    }

    await locator.click({timeout: ACTION_TIMEOUT_MS});
    await locator.fill("");

    if (action.value) await typeLikeAPerson(run, action.value);
}

async function selectOption ({locator, action}: ActionRun): Promise<void> {
    // Try selecting by visible label first, fall back to raw value.
    try {
        await locator.selectOption({label: action.value ?? ""}, {timeout: ACTION_TIMEOUT_MS});
    } catch {
        await locator.selectOption(action.value ?? "", {timeout: ACTION_TIMEOUT_MS});
    }
}

/** Where the attached file an upload action names was written. */
export function attachedFilePath (action: FillAction, attachedFilePathMap: Record<string, string>): string {
    // LLMs sometimes pass the filename as 'value' instead of 'fileKey' — accept both.
    const key = action.fileKey ?? action.value;

    if (!key) {
        throw new Error("Upload action requires a fileKey (one of the names in availableFiles).");
    }

    // File forwarded from the client via DataSourceNode (by original filename).
    const resolvedPath = attachedFilePathMap[key];

    if (!resolvedPath) {
        const availableAttached = Object.keys(attachedFilePathMap).join(", ") || "(none)";

        // eslint-disable-next-line max-len
        throw new Error(`Upload: no file found for key "${key}". Attached files: [${availableAttached}]. Make sure the file is attached via the DataSourceNode with bypass-LLM mode enabled.`);
    }

    return resolvedPath;
}

const ACTIONS: Record<FillAction["actionType"], (run: ActionRun) => Promise<void>> = {
    fill: fillField,
    select: selectOption,
    check: ({locator}) => locator.check({timeout: ACTION_TIMEOUT_MS}),
    uncheck: ({locator}) => locator.uncheck({timeout: ACTION_TIMEOUT_MS}),
    click: ({locator}) => locator.click({timeout: ACTION_TIMEOUT_MS}),
    upload: async ({locator, action, attachedFilePathMap}) => locator.setInputFiles(attachedFilePath(action, attachedFilePathMap), {timeout: ACTION_TIMEOUT_MS}),
};

/**
 * Executes a single form interaction action (fill, select, check, click, upload, …)
 * on the given Playwright page.
 */
export async function executeAction (
    page: Page,
    action: FillAction,
    attachedFilePathMap: Record<string, string>,
    typingDelay: number
): Promise<void> {
    const run = Object.hasOwn(ACTIONS, action.actionType) ? ACTIONS[action.actionType] : undefined;

    if (!run) throw new Error(`Unknown action type: "${action.actionType}"`);

    await run({page, locator: page.locator(action.selector).first(), action, attachedFilePathMap, typingDelay});
}
