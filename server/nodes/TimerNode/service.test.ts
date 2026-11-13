/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {nextScheduledTrigger, timerService} from "./service.ts";
import {isTimerTriggerEvent, SCHEDULED_TIMER_REPEATS, TIMER_NODE_MODES} from "./types.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

const at = (text: string) => new Date(text);
const NOW = at("2026-11-13T12:00:00");

Deno.test("Timer: a scheduled time still ahead is the next trigger, whatever the repeat", () => {
    for (const repeat of Object.values(SCHEDULED_TIMER_REPEATS)) {
        assertEquals(nextScheduledTrigger(at("2026-11-14T09:00:00"), repeat, NOW), at("2026-11-14T09:00:00"));
    }
});

Deno.test("Timer: a past one-off fires no more, nor does one with a repeat it doesn't know", () => {
    assertEquals(nextScheduledTrigger(at("2026-11-12T09:00:00"), SCHEDULED_TIMER_REPEATS.ONCE, NOW), null);

    // Names an object's prototype has: a lookup in a plain object would loop forever on "constructor".
    for (const repeat of ["hourly", "constructor", "toString", "__proto__"]) {
        assertEquals(nextScheduledTrigger(at("2026-11-12T09:00:00"), repeat as SCHEDULED_TIMER_REPEATS, NOW), null);
    }
});

Deno.test("Timer: a past repeating timer fires at the first repeat after now", () => {
    assertEquals(nextScheduledTrigger(at("2026-11-01T09:00:00"), SCHEDULED_TIMER_REPEATS.DAILY, NOW), at("2026-11-14T09:00:00"));
    assertEquals(nextScheduledTrigger(at("2026-11-13T12:00:00"), SCHEDULED_TIMER_REPEATS.DAILY, NOW), at("2026-11-14T12:00:00"));
    assertEquals(nextScheduledTrigger(at("2026-11-02T09:00:00"), SCHEDULED_TIMER_REPEATS.WEEKLY, NOW), at("2026-11-16T09:00:00"));
    assertEquals(nextScheduledTrigger(at("2026-08-20T09:00:00"), SCHEDULED_TIMER_REPEATS.MONTHLY, NOW), at("2026-11-20T09:00:00"));
});

Deno.test("Timer: a monthly timer on a day a month lacks fires on that month's last day, then on its day again", () => {
    assertEquals(nextScheduledTrigger(at("2027-01-31T08:00:00"), SCHEDULED_TIMER_REPEATS.MONTHLY, at("2027-02-01T00:00:00")), at("2027-02-28T08:00:00"));
    assertEquals(nextScheduledTrigger(at("2026-01-31T09:00:00"), SCHEDULED_TIMER_REPEATS.MONTHLY, at("2026-04-15T00:00:00")), at("2026-04-30T09:00:00"));
    assertEquals(nextScheduledTrigger(at("2026-01-31T09:00:00"), SCHEDULED_TIMER_REPEATS.MONTHLY, at("2026-05-01T00:00:00")), at("2026-05-31T09:00:00"));
});

Deno.test("Timer: daily and weekly timers keep their time of day across a daylight-saving change", () => {
    // Clocks went back on 25 October 2026 in much of Europe: still 09:00 after it (where there's no change, trivially).
    assertEquals(nextScheduledTrigger(at("2026-10-20T09:00:00"), SCHEDULED_TIMER_REPEATS.DAILY, NOW), at("2026-11-14T09:00:00"));
    assertEquals(nextScheduledTrigger(at("2026-10-20T09:00:00"), SCHEDULED_TIMER_REPEATS.WEEKLY, NOW), at("2026-11-17T09:00:00"));
});

Deno.test("Timer: a timer started again keeps its subscribers (a Delayed Snapshot given new input while it waits)", async () => {
    const fired: string[] = [];

    timerService.startTimer("again", {mode: TIMER_NODE_MODES.INTERVAL, interval: 5, immediate: false, runOnce: true});
    timerService.subscribe("again", event => fired.push(event.nodeId));
    timerService.startTimer("again", {mode: TIMER_NODE_MODES.INTERVAL, interval: 0.05, immediate: false, runOnce: true});

    await new Promise(resolve => setTimeout(resolve, 150));
    timerService.stopTimer("again");

    assertEquals(fired, ["again"]);
});

Deno.test("Timer: refuses a repeating interval of 0 or less, which would fire in a tight loop", () => {
    for (const interval of [0, -5]) {
        let refused = "";

        try {
            timerService.startTimer("loop", {mode: TIMER_NODE_MODES.INTERVAL, interval, immediate: false, runOnce: false});
        } catch (error) {
            refused = (error as Error).message;
        }

        assertEquals(refused, `A repeating interval timer needs an interval above 0 seconds (it was ${interval}).`);
    }

    timerService.stopTimer("loop");
});

Deno.test("Timer: an interval timer first fires after one interval, not two", async () => {
    const fired: number[] = [];
    const start = Date.now();

    timerService.startTimer("tick", {mode: TIMER_NODE_MODES.INTERVAL, interval: 0.2, immediate: false, runOnce: false});
    timerService.subscribe("tick", () => fired.push(Date.now() - start));

    await new Promise(resolve => setTimeout(resolve, 300));
    timerService.stopTimer("tick");

    // At 200 ms, then at 400 ms: by 300 ms, one (at twice the interval, none).
    assertEquals(fired.length, 1);
});

Deno.test("Timer: a timer further ahead than 24.8 days doesn't fire at once (Deno's longest setTimeout)", async () => {
    const fired: string[] = [];
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    timerService.startTimer("far-once", {mode: TIMER_NODE_MODES.SCHEDULED, scheduledDateTime: inThirtyDays, repeat: SCHEDULED_TIMER_REPEATS.ONCE, timezone: "UTC"});
    timerService.startTimer("far-interval", {mode: TIMER_NODE_MODES.INTERVAL, interval: 30 * 24 * 3600, immediate: false, runOnce: false});
    timerService.subscribe("far-once", event => fired.push(event.nodeId));
    timerService.subscribe("far-interval", event => fired.push(event.nodeId));

    await new Promise(resolve => setTimeout(resolve, 200));

    timerService.stopTimer("far-once");
    timerService.stopTimer("far-interval");
    assertEquals(fired, []);
});

Deno.test("Timer: a trigger event has a node id, a timestamp and a timer mode", () => {
    assertEquals(isTimerTriggerEvent({nodeId: "n1", timestamp: 1, type: "interval"}), true);

    const notEvents = [
        null, "x", {nodeId: 1, timestamp: 1, type: "interval"}, {nodeId: "n1", timestamp: "1", type: "interval"},
        {nodeId: "n1", timestamp: 1, type: "hourly"}, {nodeId: "n1", timestamp: 1},
    ];

    for (const event of notEvents) {
        assertEquals(isTimerTriggerEvent(event), false);
    }
});
