/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isRecord} from "../../../../../utils";
import {isDateString} from "./dates";


export const SORT_ORDER = {
    ASC: 'asc',
    DESC: 'desc'
} as const;

export type SORT_ORDER = typeof SORT_ORDER[keyof typeof SORT_ORDER];

export const ARRAY_ITEM_TYPES = {
    DATE: 'date',
    NUMBER: 'number',
    BOOLEAN: "boolean",
    STRING: 'string'
} as const;

export type ARRAY_ITEM_TYPES = typeof ARRAY_ITEM_TYPES[keyof typeof ARRAY_ITEM_TYPES];

const isBooleanValue = (val: unknown): boolean => {
    return typeof val === "boolean" ||
           (typeof val === "string" && (val.toLowerCase() === "true" || val.toLowerCase() === "false"));
};

/** A boolean, or the text "true" / "false" in any case, as 1 or 0 (anything else is 0). */
export const toBooleanNumber = (val: unknown): number => {
    if (typeof val === "boolean") return val ? 1 : 0;

    if (typeof val === "string" && val.toLowerCase() === "true") return 1;

    return 0;
};

export const allDates = <T>(array: T[], key?: string): boolean => {
    if (!Array.isArray(array) || array.length === 0) return false;

    return array.every(item => {
        if (key && isRecord(item)) {
            return isDateString(item[key]);
        } else if (!key || typeof item !== "object" || item === null) {
            return isDateString(item);
        }

        return false;
    });
}

// A number, or text that is one ("12.5"). Not null, blank text, a boolean or an array, which Number() reads as 0 or 1.
const isNumberValue = (value: unknown): boolean =>
    typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value)));

export const allNumbers = <T>(array: T[], key?: string): boolean => {
    if (!Array.isArray(array) || array.length === 0) return false;

    return array.every(item => {
        if (key && isRecord(item)) {
            const value = item[key];

            return isNumberValue(value);
        } else if (!key || typeof item !== "object" || item === null) {
            return isNumberValue(item);
        }

        return false;
    });
}

export const allBooleans = <T>(array: T[], key?: string): boolean => {
    if (!Array.isArray(array) || array.length === 0) return false;

    return array.every(item => {
        if (key && isRecord(item)) {
            const value = item[key];

            return isBooleanValue(value);
        } else if (!key || typeof item !== "object" || item === null) {
            return isBooleanValue(item);
        }

        return false;
    });
}

/** A row that is an object (not an array, not null). */
export const isObjectRow = (row: unknown): boolean => typeof row === "object" && row !== null && !Array.isArray(row);
