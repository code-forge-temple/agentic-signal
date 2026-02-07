/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {Sort} from "iconoir-react";
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

export const SortToolDescriptor: ToolDefinition = {
    toolSubtype: "sort",
    title: "Sort Tool",
    icon: <Sort />,
    toolSchema: {
        name: "sort",
        // eslint-disable-next-line max-len
        description: "Sorts an array by a specified order. Supports both arrays of objects (requires 'key' parameter to specify which property to sort by) and arrays of primitives like numbers, dates, strings, or booleans (no 'key' needed). Handles dates (ISO 8601 strings), numbers, text, and boolean comparisons (true > false). Boolean strings like 'true' and 'false' are also supported.",
        parameters: {
            type: "object",
            properties: {
                rows: {
                    type: "array",
                    description: "Array of row objects to sort or array of primitive values like numbers, dates, strings, or booleans",
                    items: {type: ["object", "string", "number", "boolean"]}
                },
                key: {
                    type: "string",
                    description: "Key to sort by (required only for arrays of objects)"
                },
                order: {
                    type: "string",
                    description: `Sort order ('${SORT_ORDER.ASC}' or '${SORT_ORDER.DESC}')`,
                    enum: [SORT_ORDER.ASC, SORT_ORDER.DESC]
                }
            },
            required: ["rows", "order"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({}),
    toSanitize: [],
    handlerFactory: () => async ({rows, key, order}: {rows: any[]; key?: string; order: SORT_ORDER}) => {
        let sanitizedRows: any[];

        try {
            sanitizedRows = sanitizeJsonInput(rows);
        } catch{
            return {error: "`rows` tool parameter must be an array"};
        }

        if (!Array.isArray(sanitizedRows)) {
            return {error: "`rows` tool parameter must be an array"};
        }

        if (order !== SORT_ORDER.ASC && order !== SORT_ORDER.DESC) {
            return {error: `\`order\` tool parameter must be '\`${SORT_ORDER.ASC}\`' or '\`${SORT_ORDER.DESC}\`'`};
        }

        if (sanitizedRows.length === 0) {
            return [];
        }

        const {allDates, allNumbers, allBooleans, allObjects} = arrayType(sanitizedRows, key);

        if (allObjects && key == undefined) {
            return {error: "`key` tool parameter is required when sorting arrays of objects"};
        }

        if (allBooleans) {
            return allObjects ?
                sortObjects(sanitizedRows, order, key!, ARRAY_ITEM_TYPES.BOOLEAN) :
                sortPrimitives(sanitizedRows, order, ARRAY_ITEM_TYPES.BOOLEAN);
        }

        if (allDates) {
            return allObjects ?
                sortObjects(sanitizedRows, order, key!, ARRAY_ITEM_TYPES.DATE) :
                sortPrimitives(sanitizedRows, order, ARRAY_ITEM_TYPES.DATE);
        }

        if (allNumbers) {
            return allObjects ?
                sortObjects(sanitizedRows, order, key!, ARRAY_ITEM_TYPES.NUMBER) :
                sortPrimitives(sanitizedRows, order, ARRAY_ITEM_TYPES.NUMBER);
        }

        return allObjects ?
            sortObjects(sanitizedRows, order, key!) :
            sortPrimitives(sanitizedRows, order);
    }
};