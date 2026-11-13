/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {resolver} from "./resolver.ts";
import {timerService} from "./service.ts";
import {TIMER_NODE_MODES} from "./types.ts";
import {GraphQLContext} from "../../graphql/types.ts";

function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

type Field = {subscribe: (...args: any[]) => AsyncIterator<unknown> | Promise<AsyncIterator<unknown>>; resolve?: (payload: any) => unknown};

/** The subscription's events as GraphQL sends them: each payload through the field's resolve, or its timerTrigger key. */
async function firstEvents (count: number, waitMs: number): Promise<unknown[]> {
    const field = resolver.Subscription.timerTrigger as Field;
    const stream = await field.subscribe(undefined, {nodeId: "sub"}, {} as GraphQLContext);
    const events: unknown[] = [];
    let timer = 0;
    const deadline = new Promise<"late">((resolve) => {
        timer = setTimeout(() => resolve("late"), waitMs);
    });

    try {
        while (events.length < count) {
            const next = await Promise.race([stream.next(), deadline]);

            if (next === "late" || next.done) break;

            events.push(field.resolve ? field.resolve(next.value) : (next.value as {timerTrigger: unknown}).timerTrigger);
        }
    } finally {
        clearTimeout(timer);
        void stream.return?.();
    }

    return events;
}

Deno.test("Timer subscription: hands on each trigger, those arriving while it waits for the next too", async () => {
    timerService.startTimer("sub", {mode: TIMER_NODE_MODES.INTERVAL, interval: 0.03, immediate: false, runOnce: false});

    try {
        const events = await firstEvents(3, 1000) as {nodeId: string; type: string}[];

        assertEquals(events.map(event => [event.nodeId, event.type]), [["sub", "interval"], ["sub", "interval"], ["sub", "interval"]]);
    } finally {
        timerService.stopTimer("sub");
    }
});
