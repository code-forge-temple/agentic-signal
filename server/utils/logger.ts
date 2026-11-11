/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export function createConditionalLog (condition: boolean) {
    return (...messages: unknown[]): void => {
        if (condition) console.log(...messages);
    };
}

/** Whether `devLog` writes anything, so work done only for its messages can be skipped otherwise. */
export const devLogging = Deno.env.get("LOGS") === "true";

export const devLog = createConditionalLog(devLogging);
