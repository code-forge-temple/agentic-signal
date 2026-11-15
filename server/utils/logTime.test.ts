/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {formatLogTime, timestampConsole} from "./logTime.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

Deno.test("formatLogTime: this computer's date and time, to the millisecond, zero-padded", () => {
    assertEquals(formatLogTime(new Date(2026, 10, 15, 18, 1, 58, 467)), "2026-11-15 18:01:58.467");
    assertEquals(formatLogTime(new Date(2026, 0, 2, 3, 4, 5, 6)), "2026-01-02 03:04:05.006");
});

Deno.test("timestampConsole: every print method starts with the time; text stays first, joined to it", () => {
    const printed: unknown[][] = [];
    const record = (...args: unknown[]) => printed.push(args);
    const target = {log: record, info: record, warn: record, error: record, debug: record};

    timestampConsole(target, () => new Date(2026, 10, 15, 18, 1, 58, 467));

    target.log("Deno server running on %s", "http://127.0.0.1:8000");
    target.error(new Error("boom"));
    target.warn("careful");

    assertEquals(printed[0], ["[2026-11-15 18:01:58.467] Deno server running on %s", "http://127.0.0.1:8000"]);
    assertEquals(printed[1][0], "[2026-11-15 18:01:58.467]");
    assertEquals(printed[1][1] instanceof Error, true);
    assertEquals(printed[2], ["[2026-11-15 18:01:58.467] careful"]);
});
