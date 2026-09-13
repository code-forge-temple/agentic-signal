/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {pendingKeyCount, withKeyedLock} from "./keyedLock.ts";

// Hand-rolled rather than pulling in @std/assert: the server has no test dependencies today,
// and these two are all this file needs.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

async function assertRejects (fn: () => Promise<unknown>, message: string): Promise<void> {
    try {
        await fn();
    } catch (error) {
        const actual = error instanceof Error ? error.message : String(error);

        if (!actual.includes(message)) throw new Error(`Expected rejection "${message}", got "${actual}"`);

        return;
    }

    throw new Error(`Expected a rejection containing "${message}", but it resolved`);
}

const tick = (ms = 0) => new Promise<void>(resolve => setTimeout(resolve, ms));

Deno.test("withKeyedLock - two tasks on one key never overlap", async () => {
    const events: string[] = [];
    const task = (name: string) => async () => {
        events.push(`enter ${name}`);

        await tick(10);

        events.push(`exit ${name}`);
    };

    await Promise.all([
        withKeyedLock("c", task("a")),
        withKeyedLock("c", task("b")),
    ]);

    assertEquals(events, ["enter a", "exit a", "enter b", "exit b"]);
});

Deno.test("withKeyedLock - different keys run concurrently", async () => {
    const events: string[] = [];
    const task = (name: string) => async () => {
        events.push(`enter ${name}`);

        await tick(10);

        events.push(`exit ${name}`);
    };

    await Promise.all([
        withKeyedLock("one", task("a")),
        withKeyedLock("two", task("b")),
    ]);

    // Interleaved, not serialised — an unrelated collection must not wait on a long embed.
    assertEquals(events, ["enter a", "enter b", "exit a", "exit b"]);
});

Deno.test("withKeyedLock - a failing task rejects its caller but not the queue", async () => {
    let ranAfter = false;

    const failing = withKeyedLock("c", async () => {
        await tick(5);

        throw new Error("ingest blew up");
    });
    const following = withKeyedLock("c", async () => {
        await tick(1);

        ranAfter = true;

        return "ok";
    });

    await assertRejects(() => failing, "ingest blew up");
    assertEquals(await following, "ok");
    assertEquals(ranAfter, true);
});

Deno.test("withKeyedLock - retains no entries once the queue drains", async () => {
    await Promise.all([
        withKeyedLock("one", () => tick(1)),
        withKeyedLock("two", () => tick(1)),
    ]);

    // The tail's cleanup is itself a microtask hop behind the settled result.
    await tick(5);

    assertEquals(pendingKeyCount(), 0);
});

Deno.test("withKeyedLock - prevents the lost update it exists for", async () => {
    // Models the real cycle: read a whole blob, await something slow, write the whole blob back.
    let blob: Record<string, string> = {a: "1"};

    const readModifyWrite = (name: string) => async () => {
        const snapshot = {...blob};

        await tick(10); // stands in for ollama.embed()

        blob = {...snapshot, [name]: "new"};
    };

    await Promise.all([
        withKeyedLock("meta", readModifyWrite("b")),
        withKeyedLock("meta", readModifyWrite("c")),
    ]);

    assertEquals(blob, {a: "1", b: "new", c: "new"});
});

Deno.test("control - the same cycle DOES lose an update without the lock", async () => {
    let blob: Record<string, string> = {a: "1"};

    const readModifyWrite = async (name: string) => {
        const snapshot = {...blob};

        await tick(10);

        blob = {...snapshot, [name]: "new"};
    };

    await Promise.all([readModifyWrite("b"), readModifyWrite("c")]);

    // b is gone: proof the test above is measuring something real.
    assertEquals(blob, {a: "1", c: "new"});
});
