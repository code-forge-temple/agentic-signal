/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// Kept apart from service.ts, which loads the browser, so they can be tested on their own.

const REDIRECT_STABLE_MS = 3_000;

/**
 * How long to wait for the next redirect: until the URL has been stable for a while, within what's left of the budget.
 * Null once the budget is spent (a timeout of 0 would mean no limit at all to Playwright).
 */
export function nextRedirectWaitMs (deadline: number, now: number): number | null {
    const remaining = deadline - now;

    return remaining > 0 ? Math.min(REDIRECT_STABLE_MS, remaining) : null;
}

/**
 * A button label as a consent wall's accept button may carry it: as whole words, any case, and not a refusal, so
 * "Agree" picks "I agree" or "AGREE and continue" but not "Disagree", "I do not agree" or "Don't agree".
 */
export function consentLabelPattern (label: string): RegExp {
    const words = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(`(?<!not )(?<!n't )(?<!n’t )\\b${words}\\b`, "i");
}
