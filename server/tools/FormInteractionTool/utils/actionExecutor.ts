/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FillAction} from "../types.ts";

export const ACTION_TIMEOUT_MS = 8_000;

/**
 * Executes a single form interaction action (fill, select, check, click, upload, …)
 * on the given Playwright page.
 */
export async function executeAction (
    page: any,
    action: FillAction,
    attachedFilePathMap: Record<string, string>,
    typingDelay: number
): Promise<void> {
    const locator = page.locator(action.selector).first();

    switch (action.actionType) {
        case "fill": {
            // Detect input type to decide how to fill.
            // Date, number, and other special inputs don't work well with pressSequentially —
            // Playwright's fill() correctly handles their native parsing.
            const inputType: string = await locator
                .evaluate((el: Element) => {
                    if (el.getAttribute("contenteditable") === "true") return "contenteditable";

                    return (el as HTMLInputElement).type || el.tagName.toLowerCase();
                })
                .catch(() => "text");

            const useNativeFill = ["date", "datetime-local", "month", "week", "time", "number", "range"].includes(inputType);

            if (useNativeFill || typingDelay <= 0) {
                // Instant mode or special input type: set value directly.
                await locator.fill(action.value ?? "", {timeout: ACTION_TIMEOUT_MS});
            } else {
                await locator.click({timeout: ACTION_TIMEOUT_MS});
                await locator.fill("");

                if (action.value) {
                    // Type character by character, pressing Enter for actual newlines
                    // so textarea and contenteditable get proper line breaks.
                    // Normalize LLM-emitted escape sequences: some models double-escape
                    // and send the two-char literal '\n' instead of an actual newline.
                    const normalizedValue = action.value
                        .replace(/\\n/g, "\n")
                        .replace(/\\r/g, "\r")
                        .replace(/\\t/g, "\t");

                    const segments = normalizedValue.split("\n");
                    // Per-character delay: typingDelay × 80ms base, ±50% jitter.
                    const delay = Math.max(10, Math.floor(typingDelay * 80 * (0.5 + Math.random())));
                    // Playwright's default action timeout (30s) covers the WHOLE call, including
                    // every inter-keystroke delay — a long value at a human-like pace can legitimately
                    // take longer than that. Size the timeout to the actual expected typing duration
                    // (plus a safety margin) instead of racing the default.
                    const typer = typeof locator.pressSequentially === "function"
                        ? (text: string) => locator.pressSequentially(text, {delay, timeout: Math.max(ACTION_TIMEOUT_MS, text.length * delay + 10_000)})
                        : (text: string) => locator.type(text, {delay, timeout: Math.max(ACTION_TIMEOUT_MS, text.length * delay + 10_000)});

                    for (let s = 0; s < segments.length; s++) {
                        if (segments[s].length > 0) await typer(segments[s]);

                        if (s < segments.length - 1) await page.keyboard.press("Enter");
                    }
                }
            }

            break;
        }

        case "select":
            // Try selecting by visible label first, fall back to raw value.
            try {
                await locator.selectOption({label: action.value ?? ""}, {timeout: ACTION_TIMEOUT_MS});
            } catch {
                await locator.selectOption(action.value ?? "", {timeout: ACTION_TIMEOUT_MS});
            }

            break;

        case "check":
            await locator.check({timeout: ACTION_TIMEOUT_MS});
            break;

        case "uncheck":
            await locator.uncheck({timeout: ACTION_TIMEOUT_MS});
            break;

        case "click":
            await locator.click({timeout: ACTION_TIMEOUT_MS});
            break;

        case "upload": {
            // LLMs sometimes pass the filename as 'value' instead of 'fileKey' — accept both.
            const key = action.fileKey ?? action.value;

            if (!key) {
                throw new Error("Upload action requires a fileKey (the original file name or a configured alias).");
            }

            // File forwarded from the client via DataSourceNode (by original filename).
            const resolvedPath = attachedFilePathMap[key];

            if (!resolvedPath) {
                const availableAttached = Object.keys(attachedFilePathMap).join(", ") || "(none)";

                throw new Error(
                    `Upload: no file found for key "${key}". ` +
                    `Attached files: [${availableAttached}]. ` +
                    `Make sure the file is attached via the DataSourceNode with bypass-LLM mode enabled.`
                );
            }

            await locator.setInputFiles(resolvedPath, {timeout: ACTION_TIMEOUT_MS});
            break;
        }

        default:
            throw new Error(`Unknown action type: "${(action as any).actionType}"`);
    }
}
