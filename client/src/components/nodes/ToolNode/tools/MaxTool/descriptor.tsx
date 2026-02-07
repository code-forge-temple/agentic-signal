/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {SortDown} from "iconoir-react";
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

export const MaxToolDescriptor: ToolDefinition = {
    toolSubtype: "max",
    title: "Max Tool",
    icon: <SortDown />,
    toolSchema: {
        name: "max",
        // eslint-disable-next-line max-len
        description: "Finds the row(s) or value(s) with the maximum value. Supports both arrays of objects (optionally specify 'key' to compare a property) and arrays of primitives like numbers, dates, strings, or booleans (no 'key' needed). Returns all items that share the maximum value. Handles dates (ISO 8601 strings), numbers, text, and boolean comparisons (true > false).",
        parameters: {
            type: "object",
            properties: {
                rows: {
                    type: "array",
                    description: "Array of objects or primitive values (numbers, dates, strings, booleans) to search",
                    items: {}
                },
                key: {
                    type: "string",
                    description: "Key to find max by (required, but ignored for arrays of primitives)"
                }
            },
            required: ["rows", "key"],
            additionalProperties: false
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

        if (allObjects) {
            if(!key){
                return {error: "`key` tool parameter is required when finding max in arrays of objects"};
            } else {
                const keyExists = sanitizedRows.some(row => Object.prototype.hasOwnProperty.call(row, key));

                if (!keyExists) {
                    return {error: `\`key\` tool parameter '${key}' provided not found in any object of the \`rows\` array tool parameter`};
                }
            }
        }

        let sorted;

        if (allBooleans) {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.DESC, key!, ARRAY_ITEM_TYPES.BOOLEAN) :
                sortPrimitives(sanitizedRows, SORT_ORDER.DESC, ARRAY_ITEM_TYPES.BOOLEAN);
        } else if (allDates) {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.DESC, key!, ARRAY_ITEM_TYPES.DATE) :
                sortPrimitives(sanitizedRows, SORT_ORDER.DESC, ARRAY_ITEM_TYPES.DATE);
        } else if (allNumbers) {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.DESC, key!, ARRAY_ITEM_TYPES.NUMBER) :
                sortPrimitives(sanitizedRows, SORT_ORDER.DESC, ARRAY_ITEM_TYPES.NUMBER);
        } else {
            sorted = allObjects ?
                sortObjects(sanitizedRows, SORT_ORDER.DESC, key!) :
                sortPrimitives(sanitizedRows, SORT_ORDER.DESC);
        }

        const maxVal = (() => {
            const val = allObjects ? sorted[0][key!] : sorted[0];

            if (allBooleans) return val ? 1 : 0;

            if (allDates) return new Date(val).getTime();

            if (allNumbers) return Number(val);

            return val;
        })();

        const maxRows = sorted.filter(row => {
            let rowVal = allObjects ? row[key!] : row;

            if (allBooleans) rowVal = rowVal ? 1 : 0;

            if (allDates) rowVal = new Date(rowVal).getTime();

            if (allNumbers) rowVal = Number(rowVal);

            return rowVal === maxVal;
        });

        return maxRows;
    }
};