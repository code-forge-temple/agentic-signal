/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isRecord} from "../../../../../utils";
import {ToolError} from "../../../../../types/tool.types";
import {sanitizeJsonInput} from "./sanitize";
import {allBooleans, allDates, allNumbers, ARRAY_ITEM_TYPES, isObjectRow, SORT_ORDER, toBooleanNumber} from "./sort";
import {dateTime} from "./dates";


const ROWS_NOT_AN_ARRAY = "`rows` tool parameter must be an array";

/**
 * How the rows are read: by `key` when they are objects (any row is one; a row among them that isn't, a null say, has no
 * value), else each row as it is.
 */
type RowsReading = {key?: string; objects: boolean};

/** What the rows hold: how they're read, and the type their values compare as (undefined: as text). */
export type RowsShape = RowsReading & {itemType: ARRAY_ITEM_TYPES | undefined};

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

const readingOf = (rows: unknown[], key: string | undefined): RowsReading => ({key, objects: rows.some(isObjectRow)});

/** The value a row is compared by: its `key` when the rows are objects (none for a row that isn't one), else the row itself. */
const rowValue = (row: unknown, {key, objects}: RowsReading): unknown => {
    if (!objects) return row;

    return isRecord(row) ? row[key!] : undefined;
};

/** How values compare: as booleans, dates or numbers when they all are one, else as text. */
function itemTypeOf (values: unknown[]): ARRAY_ITEM_TYPES | undefined {
    if (allBooleans(values)) return ARRAY_ITEM_TYPES.BOOLEAN;

    if (allDates(values)) return ARRAY_ITEM_TYPES.DATE;

    if (allNumbers(values)) return ARRAY_ITEM_TYPES.NUMBER;

    return undefined;
}

const shapeOf = (rows: unknown[], reading: RowsReading): RowsShape =>
    ({...reading, itemType: itemTypeOf(rows.map(row => rowValue(row, reading)))});

/** What `rows` hold, their values read from `key` when they're objects. */
export const rowsShape = (rows: unknown[], key: string | undefined): RowsShape => shapeOf(rows, readingOf(rows, key));

const isMissing = (value: unknown) => value === undefined || value === null;
const isBlankText = (value: unknown) => typeof value === "string" && value.trim() === "";
const isEmptyList = (value: unknown) => Array.isArray(value) && value.length === 0;

/** A value to compare: not missing, null, blank text or an empty list. */
const hasValue = (value: unknown): boolean => !isMissing(value) && !isBlankText(value) && !isEmptyList(value);

/** The rows that have a value to compare, and those that don't (each in their order). */
function splitByValue (rows: unknown[], reading: RowsReading): {valued: unknown[]; unvalued: unknown[]} {
    const valued: unknown[] = [];
    const unvalued: unknown[] = [];

    for (const row of rows) (hasValue(rowValue(row, reading)) ? valued : unvalued).push(row);

    return {valued, unvalued};
}

/** A row's value as the rows are sorted and min and max compare it: booleans as 1 or 0, dates as times, numbers as numbers, anything else as text. */
function comparableValue (row: unknown, shape: RowsShape): number | string {
    const value = rowValue(row, shape);

    if (shape.itemType === ARRAY_ITEM_TYPES.BOOLEAN) return toBooleanNumber(value);

    if (shape.itemType === ARRAY_ITEM_TYPES.DATE) return dateTime(value);

    if (shape.itemType === ARRAY_ITEM_TYPES.NUMBER) return Number(value);

    return String(value);
}

/** Two comparable values in ascending order: numbers as numbers, text as text. */
const ascending = (a: number | string, b: number | string): number => {
    if (a === b) return 0;

    return a > b ? 1 : -1;
};

type Entry = {row: unknown; value: number | string};

/** The rows with their comparable values (worked out once a row), sorted in `order`; rows that compare equal keep their order. */
function sortedEntries (rows: unknown[], order: SORT_ORDER, shape: RowsShape): Entry[] {
    const direction = order === SORT_ORDER.ASC ? 1 : -1;

    return rows.map(row => ({row, value: comparableValue(row, shape)})).sort((a, b) => direction * ascending(a.value, b.value));
}

/** The valued rows of `rows`, sorted in `order` as the type their values are, and the rows with no value. */
function sortedByValue (rows: unknown[], order: SORT_ORDER, key: string | undefined): {entries: Entry[]; unvalued: unknown[]} {
    const reading = readingOf(rows, key);
    const {valued, unvalued} = splitByValue(rows, reading);

    return {entries: sortedEntries(valued, order, shapeOf(valued, reading)), unvalued};
}

/**
 * The rows sorted in `order` by their value (their `key` when they're objects), compared as the type all the values
 * are; rows with no value come last, in their order.
 */
export function sortRows (rows: unknown[], order: SORT_ORDER, key: string | undefined): unknown[] {
    const {entries, unvalued} = sortedByValue(rows, order, key);

    return [...entries.map(({row}) => row), ...unvalued];
}

/**
 * Why rows of objects can't be read by `key`, or null when they can (or aren't objects): there's no key (`noKeyError`),
 * or no object has it.
 */
export function keyProblem (rows: unknown[], key: string | undefined, noKeyError: string): string | null {
    if (!readingOf(rows, key).objects) return null;

    if (!key) return noKeyError;

    if (!rows.some(row => isRecord(row) && Object.prototype.hasOwnProperty.call(row, key))) {
        return `\`key\` tool parameter '${key}' provided not found in any object of the \`rows\` array tool parameter`;
    }

    return null;
}

type ExtremeOptions = {
    order: SORT_ORDER;
    /** "min" or "max", for the errors. */
    name: string;
};

/**
 * The rows that share the first value in `order` (the smallest ascending, the largest descending): of the rows
 * themselves, or of their `key` when they're objects. Rows with no value there are left out; none when no row has one.
 */
export function extremeRows (rows: unknown, key: string | undefined, {order, name}: ExtremeOptions): unknown[] | ToolError {
    const parsed = parseRows(rows);

    if (!Array.isArray(parsed)) return parsed;

    const problem = keyProblem(parsed, key, `\`key\` tool parameter is required when finding ${name} in arrays of objects`);

    if (problem) return {error: problem};

    const {entries} = sortedByValue(parsed, order, key);

    return entries.filter(({value}) => value === entries[0].value).map(({row}) => row);
}
