/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isRecord} from "../../../../../utils";
import {ToolError} from "../../../../../types/ollama.types";
import {sanitizeJsonInput} from "./sanitize";
import {ARRAY_ITEM_TYPES, arrayType, SORT_ORDER, sortObjects, sortPrimitives, toBooleanNumber} from "./sort";


const ROWS_NOT_AN_ARRAY = "`rows` tool parameter must be an array";

/** What the rows hold: objects or not (and the key to read then), and the type they compare as. */
export type RowsShape = {
    key?: string;
    allObjects: boolean;
    /** Undefined: the rows compare as text. */
    itemType: ARRAY_ITEM_TYPES | undefined;
};

/** The `rows` the LLM sent, as an array; an error when they aren't one. */
export function parseRows (rows: unknown): unknown[] | ToolError {
    let parsed: unknown;

    try {
        parsed = sanitizeJsonInput(rows);
    } catch {
        return {error: ROWS_NOT_AN_ARRAY};
    }

    return Array.isArray(parsed) ? parsed : {error: ROWS_NOT_AN_ARRAY};
}

/** How the rows compare: as booleans, dates or numbers when they all are one, else as text. */
function rowItemType ({allBooleans, allDates, allNumbers}: ReturnType<typeof arrayType>): ARRAY_ITEM_TYPES | undefined {
    if (allBooleans) return ARRAY_ITEM_TYPES.BOOLEAN;

    if (allDates) return ARRAY_ITEM_TYPES.DATE;

    if (allNumbers) return ARRAY_ITEM_TYPES.NUMBER;

    return undefined;
}

/** What `rows` hold, their values read from `key` when they're objects. */
export function rowsShape (rows: unknown[], key: string | undefined): RowsShape {
    const types = arrayType(rows, key);

    return {key, allObjects: types.allObjects, itemType: rowItemType(types)};
}

/** The rows sorted in `order`: objects by their `key`, all compared as the shape's item type. */
export const sortRows = (rows: unknown[], order: SORT_ORDER, {key, allObjects, itemType}: RowsShape): unknown[] =>
    (allObjects ? sortObjects(rows.filter(isRecord), order, key!, itemType) : sortPrimitives(rows, order, itemType));

/** A row's value as min and max compare it, as the sort did: booleans as 1 or 0, dates as times, numbers as numbers, anything else as it is. */
function comparableValue (row: unknown, {key, allObjects, itemType}: RowsShape): unknown {
    const value = allObjects && isRecord(row) ? row[key!] : row;

    if (itemType === ARRAY_ITEM_TYPES.BOOLEAN) return toBooleanNumber(value);

    if (itemType === ARRAY_ITEM_TYPES.DATE) return new Date(String(value)).getTime();

    if (itemType === ARRAY_ITEM_TYPES.NUMBER) return Number(value);

    return value;
}

type ExtremeOptions = {
    order: SORT_ORDER;
    /** "min" or "max", for the errors. */
    name: string;
};

/** Why objects can't be compared by `key`, or null when they can: there's no key, or no object has it. */
function keyProblem (rows: unknown[], key: string | undefined, {name}: ExtremeOptions): string | null {
    if (!key) return `\`key\` tool parameter is required when finding ${name} in arrays of objects`;

    if (!rows.some(row => Object.prototype.hasOwnProperty.call(row, key))) {
        return `\`key\` tool parameter '${key}' provided not found in any object of the \`rows\` array tool parameter`;
    }

    return null;
}

/**
 * The rows that share the first value in `order` (the smallest ascending, the largest descending): of the rows
 * themselves, or of their `key` when they're objects.
 */
export function extremeRows (rows: unknown, key: string | undefined, options: ExtremeOptions): unknown[] | ToolError {
    const parsed = parseRows(rows);

    if (!Array.isArray(parsed)) return parsed;

    if (parsed.length === 0) return [];

    const shape = rowsShape(parsed, key);
    const problem = shape.allObjects ? keyProblem(parsed, key, options) : null;

    if (problem) return {error: problem};

    const sorted = sortRows(parsed, options.order, shape);
    const extreme = comparableValue(sorted[0], shape);

    return sorted.filter(row => comparableValue(row, shape) === extreme);
}
