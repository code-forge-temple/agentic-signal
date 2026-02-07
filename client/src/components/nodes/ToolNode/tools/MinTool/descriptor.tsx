/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {SortUp} from "iconoir-react";
import {ToolDefinition} from "../types";
import {
    sortPrimitives,
    sortObjects,
    arrayType,
    ARRAY_ITEM_TYPES,
    SORT_ORDER
} from "../utils/sort";
import {sanitizeJsonInput} from "../utils/sanitize";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";

export const MinToolDescriptor: ToolDefinition = {
    toolSubtype: "min",
    title: "Min Tool",
    icon: <SortUp />,
    toolSchema: {
        name: "min",
        // eslint-disable-next-line max-len
        description: "Finds the row(s) or value(s) with the minimum value. Supports both arrays of objects (requires 'key' parameter to specify which property to compare) and arrays of primitives like numbers, dates, strings, or booleans (no 'key' needed). Returns all items that share the minimum value. Handles dates (ISO 8601 strings), numbers, text, and boolean comparisons (false < true).",
        parameters: {
            type: "object",
            properties: {
                rows: {
                    type: "array",
                    description: "Array of row objects to search or array of primitive values like numbers, dates, strings, or booleans",
                    items: {type: ["object", "string", "number", "boolean"]}
                },
                key: {
                    type: "string",
                    description: "Key to find min by (required only for arrays of objects)"
                }
            },
            required: ["rows"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({}),
    toSanitize: [],
    handlerFactory: () => async ({rows, key}: {rows: any[]; key?: string}) => {
        let sanitizedRows: any[];

        try {
            sanitizedRows = sanitizeJsonInput(rows);
        } catch {
            return {error: "`rows` tool parameter must be an array"};
        }

        if (!Array.isArray(sanitizedRows)) {
            return {error: "`rows` tool parameter must be an array"};
        }

        if (sanitizedRows.length === 0) {
            return [];
        }

        const {allDates, allNumbers, allBooleans, allObjects} = arrayType(sanitizedRows, key);

        if (allObjects && !key) {
            return {error: "`key` tool parameter is required when finding min in arrays of objects"};
        }

        let sorted;

        if (allBooleans) {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.ASC, key!, ARRAY_ITEM_TYPES.BOOLEAN) :
                sortPrimitives(sanitizedRows, SORT_ORDER.ASC, ARRAY_ITEM_TYPES.BOOLEAN);
        } else if (allDates) {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.ASC, key!, ARRAY_ITEM_TYPES.DATE) :
                sortPrimitives(sanitizedRows, SORT_ORDER.ASC, ARRAY_ITEM_TYPES.DATE);
        } else if (allNumbers) {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.ASC, key!, ARRAY_ITEM_TYPES.NUMBER) :
                sortPrimitives(sanitizedRows, SORT_ORDER.ASC, ARRAY_ITEM_TYPES.NUMBER);
        } else {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.ASC, key!) :
                sortPrimitives(sanitizedRows, SORT_ORDER.ASC);
        }

        const minVal = (() => {
            const val = allObjects ? sorted[0][key!] : sorted[0];

            if (allBooleans) return val ? 1 : 0;

            if (allDates) return new Date(val).getTime();

            if (allNumbers) return Number(val);

            return val;
        })();

        const minRows = sorted.filter(row => {
            let rowVal = allObjects ? row[key!] : row;

            if (allBooleans) rowVal = rowVal ? 1 : 0;

            if (allDates) rowVal = new Date(rowVal).getTime();

            if (allNumbers) rowVal = Number(rowVal);

            return rowVal === minVal;
        });

        return minRows;
    }
};