/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** This computer's time, to the millisecond: "2026-11-15 18:01:58.467". */
export function formatLogTime (date: Date): string {
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

    return `${day} ${time}`;
}

type PrintMethod = "log" | "info" | "warn" | "error" | "debug";

const PRINT_METHODS: PrintMethod[] = ["log", "info", "warn", "error", "debug"];

/**
 * Starts every message printed through `target` with the time, so the log (backend.log in the desktop app) shows when
 * each thing happened. Deno's own warnings print through the console too. A message that starts with text keeps it
 * first, joined to the time, so a format string (%s) still applies.
 */
export function timestampConsole (target: Pick<Console, PrintMethod> = console, now: () => Date = () => new Date()): void {
    for (const method of PRINT_METHODS) {
        const print = target[method].bind(target);

        target[method] = (...args: unknown[]) => {
            const stamp = `[${formatLogTime(now())}]`;

            if (typeof args[0] === "string") print(`${stamp} ${args[0]}`, ...args.slice(1));
            else print(stamp, ...args);
        };
    }
}
