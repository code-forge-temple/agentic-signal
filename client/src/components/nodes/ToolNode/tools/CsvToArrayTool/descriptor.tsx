/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Table2Columns} from "iconoir-react";
import {ToolDefinition} from "../types";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";

export const CsvToArrayToolDescriptor: ToolDefinition = {
    toolSubtype: "csv-to-array",
    title: "CSV to Array Tool",
    icon: <Table2Columns />,
    toolSchema: {
        name: "csvToArray",
        description: `
Converts a CSV (Comma-Separated Values) string into a structured JSON array of objects.

**When to use this tool:**
- When you have CSV data that needs to be parsed into a usable format
- When you need to access individual rows and columns from CSV data
- Before performing any operations on CSV data (filtering, sorting, analysis, etc.)

**Input:** A CSV string with:
- First row: column headers (comma-separated)
- Subsequent rows: data values (comma-separated)

**Output:** A JSON array where:
- Each array element is an object representing one data row
- Object keys are the column names from the CSV header
- Object values are the corresponding cell values (as strings)

**Important:** You MUST call this tool when working with CSV data before any other operations.`,
        parameters: {
            type: "object",
            properties: {
                csv: {
                    type: "string",
                    description: "CSV string to convert"
                }
            },
            required: ["csv"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({}),
    toSanitize: [],
    handlerFactory: () => async ({csv}: {csv: string}) => {
        if (typeof csv !== "string") {
            return {error: "`csv` tool parameter must be a string"};
        }

        const lines = csv.trim().split(/\r?\n/);

        if (lines.length < 1) return [];

        const headers = lines[0].split(",").map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const values = line.split(",").map(v => v.trim());
            const obj: Record<string, string> = {};

            headers.forEach((h, i) => {
                obj[h] = values[i] ?? "";
            });

            return obj;
        });

        return rows;
    }
};