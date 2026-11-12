/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {SortDown} from "iconoir-react";
import {ToolDefinition} from "../types";
import {SORT_ORDER} from "../utils/sort";
import {extremeRows} from "../utils/rows";
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
    handlerFactory: () => async ({rows, key}: {rows: unknown; key?: string}) =>
        extremeRows(rows, key, {order: SORT_ORDER.DESC, name: "max"}),
};
