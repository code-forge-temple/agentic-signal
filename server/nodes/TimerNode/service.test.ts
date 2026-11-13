/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {nextScheduledTrigger} from "./service.ts";
import {isTimerTriggerEvent, SCHEDULED_TIMER_REPEATS} from "./types.ts";

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

Deno.test("Timer: a monthly timer on a day a month lacks fires on that month's last day", () => {
    assertEquals(nextScheduledTrigger(at("2027-01-31T08:00:00"), SCHEDULED_TIMER_REPEATS.MONTHLY, at("2027-02-01T00:00:00")), at("2027-02-28T08:00:00"));
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
