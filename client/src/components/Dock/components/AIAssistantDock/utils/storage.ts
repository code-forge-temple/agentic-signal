/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/**
 * The only module in this feature that touches JSON. The global config store holds
 * `string | undefined`, so every read has to survive a missing key, the empty string
 * `setGlobalData(key, "")` leaves behind, and anything a user hand-edited into
 * localStorage.
 */

/**
 * Returns null — never throws — for undefined, "", invalid JSON, and any valid JSON that
 * isn't a plain object ("null", "5", "[]"). Callers treat null as "nothing stored yet".
 */
export const readJsonRecord = (raw: string | undefined): Record<string, unknown> | null => {
    if (!raw) return null;

    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

    return parsed as Record<string, unknown>;
};

export const writeJsonRecord = (value: object): string => JSON.stringify(value);
