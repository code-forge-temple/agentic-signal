/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/** A typed count kept within its range; null when the text isn't a number, as in a cleared field. */
export function countWithin (text: string, min: number, max: number): number | null {
    const count = parseInt(text);

    return Number.isNaN(count) ? null : Math.max(min, Math.min(max, count));
}

/**
 * Saves a typed count kept within its range, and gives back the text of what it saved, for the field to show. Text
 * that isn't a number, as in a cleared field, saves nothing and gives nothing back: the node keeps its count until a
 * number is typed.
 */
export function saveCountWithin (text: string, min: number, max: number, save: (count: number) => void): string | undefined {
    const count = countWithin(text, min, max);

    if (count === null) return undefined;

    save(count);

    return String(count);
}
