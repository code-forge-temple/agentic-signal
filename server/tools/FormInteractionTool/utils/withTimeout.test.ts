/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {withDeadline} from "./withTimeout.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

Deno.test("gives back what the work returns, and tells the work it's over", async () => {
    let signal: AbortSignal | undefined;
    const work = async (given: AbortSignal) => {
        signal = given;

        return "done";
    };

    assertEquals(await withDeadline(work, 1_000, "too slow"), "done");
    assertEquals(signal?.aborted, true);
});

Deno.test("passes on the work's own failure", async () => {
    const message = await withDeadline(() => Promise.reject(new Error("broken")), 1_000, "too slow").catch((error: Error) => error.message);

    assertEquals(message, "broken");
});

Deno.test("fails at the deadline, and by then the work has been told to stop", async () => {
    let toldToStop = false;
    // Work that never finishes on its own; it only notes when it's told to stop.
    const work = (signal: AbortSignal) => new Promise<never>(() => {
        signal.addEventListener("abort", () => { toldToStop = true; });
    });

    const message = await withDeadline(work, 20, "too slow").catch((error: Error) => error.message);

    assertEquals(message, "too slow");
    assertEquals(toldToStop, true);
});
