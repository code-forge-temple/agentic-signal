/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isRecord} from "../../../../../utils";


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

type AnyObject = Record<string, unknown>;

export const sortPrimitives = <T>(
    array: T[],
    order: SORT_ORDER = SORT_ORDER.ASC,
    sortAs: ARRAY_ITEM_TYPES = ARRAY_ITEM_TYPES.STRING
): T[] => {
    if (array.length === 0) {
        return [];
    }

    let sorted: T[] = [];

    if (sortAs === ARRAY_ITEM_TYPES.BOOLEAN) {
        sorted = [...array].sort((a, b) => {
            const aNum = toBooleanNumber(a);
            const bNum = toBooleanNumber(b);

            if (aNum === bNum) return 0;

            if (order === SORT_ORDER.ASC) return aNum > bNum ? 1 : -1;

            return aNum < bNum ? 1 : -1;
        });
    } else if (sortAs === ARRAY_ITEM_TYPES.DATE) {
        sorted = [...array].sort((a, b) => {
            const aTime = new Date(a as any).getTime();
            const bTime = new Date(b as any).getTime();

            if (aTime === bTime) return 0;

            if (order === SORT_ORDER.ASC) return aTime > bTime ? 1 : -1;

            return aTime < bTime ? 1 : -1;
        });
    } else if (sortAs === ARRAY_ITEM_TYPES.NUMBER) {
        sorted = [...array].sort((a, b) => {
            const aNum = Number(a);
            const bNum = Number(b);

            if (aNum === bNum) return 0;

            if (order === SORT_ORDER.ASC) return aNum > bNum ? 1 : -1;

            return aNum < bNum ? 1 : -1;
        });
    } else {
        // Otherwise, sort as strings
        sorted = [...array].sort((a, b) => {
            if (a === b) return 0;

            if (order === SORT_ORDER.ASC) return a > b ? 1 : -1;

            return a < b ? 1 : -1;
        });
    }

    return sorted;
}

export const sortObjects = <T extends AnyObject>(
    array: T[],
    order: SORT_ORDER = SORT_ORDER.ASC,
    key: string,
    sortAs: ARRAY_ITEM_TYPES = ARRAY_ITEM_TYPES.STRING
): T[] => {
    if (array.length === 0) {
        return [];
    }

    let sorted : T[] = [];

    if (sortAs === ARRAY_ITEM_TYPES.BOOLEAN) {
        sorted = [...array].sort((a, b) => {
            const aNum = toBooleanNumber(a[key]);
            const bNum = toBooleanNumber(b[key]);

            if (aNum === bNum) return 0;

            if (order === SORT_ORDER.ASC) return aNum > bNum ? 1 : -1;

            return aNum < bNum ? 1 : -1;
        });
    } else if (sortAs === ARRAY_ITEM_TYPES.DATE) {
        sorted = [...array].sort((a, b) => {
            const aTime = new Date(a[key] as any).getTime();
            const bTime = new Date(b[key] as any).getTime();

            if (aTime === bTime) return 0;

            if (order === SORT_ORDER.ASC) return aTime > bTime ? 1 : -1;

            return aTime < bTime ? 1 : -1;
        });
    } else if (sortAs === ARRAY_ITEM_TYPES.NUMBER) {
        sorted = [...array].sort((a, b) => {
            const aNum = Number(a[key]);
            const bNum = Number(b[key]);

            if (aNum === bNum) return 0;

            if (order === SORT_ORDER.ASC) return aNum > bNum ? 1 : -1;

            return aNum < bNum ? 1 : -1;
        });
    } else {
        // Otherwise, sort as strings
        sorted = [...array].sort((a, b) => {
            const aVal = String(a[key]);
            const bVal = String(b[key]);

            if (aVal === bVal) return 0;

            if (order === SORT_ORDER.ASC) return aVal > bVal ? 1 : -1;

            return aVal < bVal ? 1 : -1;
        });
    }

    return sorted;
}

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

// Text a date can be read from. A number written as text ("10", "2024") isn't one, although V8 reads it as a date
// ("10" as 1 October 2001): it compares as a number.
const isDateString = (value: unknown): boolean =>
    typeof value === "string" && isNaN(Number(value)) && !isNaN(Date.parse(value));

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

export const allNumbers = <T>(array: T[], key?: string): boolean => {
    if (!Array.isArray(array) || array.length === 0) return false;

    return array.every(item => {
        if (key && isRecord(item)) {
            const value = item[key];

            return typeof value === "number" || (value !== "" && !isNaN(Number(value)));
        } else if (!key || typeof item !== "object" || item === null) {
            return typeof item === "number" || (item !== "" && !isNaN(Number(item)));
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

export function arrayType (rows: any[], key?: string) {
    const allObjects = rows.every(row => typeof row === "object" && row !== null && !Array.isArray(row));

    return {
        allDates: allDates(rows, key),
        allNumbers: allNumbers(rows, key),
        allBooleans: allBooleans(rows, key),
        allObjects
    };
}