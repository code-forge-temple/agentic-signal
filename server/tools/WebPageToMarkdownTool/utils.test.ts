/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {consentLabelPattern, nextRedirectWaitMs} from "./utils.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

Deno.test("an accept label matches the button however it's cased or continued", () => {
    for (const name of ["Agree", "I agree", "AGREE and continue", "agree & close"]) {
        assertEquals(consentLabelPattern("Agree").test(name), true);
    }

    assertEquals(consentLabelPattern("Accept all").test("Accept all cookies"), true);
    assertEquals(consentLabelPattern("Accept all").test("ACCEPT ALL"), true);
});

Deno.test("an accept label never matches a button that refuses", () => {
    for (const name of ["Disagree", "I disagree", "I do not agree", "Don't agree", "Don’t agree", "Do not accept all"]) {
        const refused = consentLabelPattern(name.toLowerCase().includes("accept") ? "Accept all" : "Agree").test(name);

        assertEquals(refused, false);
    }
});

Deno.test("waits for the next redirect within the budget, and not at all once it's spent", () => {
    assertEquals(nextRedirectWaitMs(20_000, 0), 3_000);
    assertEquals(nextRedirectWaitMs(20_000, 18_500), 1_500);
    assertEquals(nextRedirectWaitMs(20_000, 20_000), null);
    assertEquals(nextRedirectWaitMs(20_000, 20_001), null);
});
