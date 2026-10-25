/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TRIPLE_BACKTICK} from "@shared/constants";
import {csvToMarkdownTable} from "../../../utils";

const CSV_BLOCK_REGEX = /```csv\s*([\s\S]*?)```/gi;

export function reformatContent (value: string): string {
    if (!value) return "";

    const trimmed = value.trim();

    if (trimmed.length > 50000) return trimmed;

    const csvConverted = trimmed.replace(CSV_BLOCK_REGEX, (_match, csvContent) => {
        const table = csvToMarkdownTable(csvContent);

        return table || _match;
    });

    if (csvConverted !== trimmed) {
        return csvConverted;
    }

    if (/^```(json|js|javascript|html|md|markdown)[\s\S]*```$/m.test(trimmed)) {
        return trimmed;
    }

    try {
        JSON.parse(trimmed);

        return `${TRIPLE_BACKTICK}json\n${trimmed}\n${TRIPLE_BACKTICK}`;
    } catch {
        if (/<html[\s\S]*?>[\s\S]*<\/html>/i.test(trimmed) || /<body[\s\S]*?>[\s\S]*<\/body>/i.test(trimmed)) {
            return `${TRIPLE_BACKTICK}html\n${trimmed}\n${TRIPLE_BACKTICK}`;
        }

        if (/function\s*\(|=>|\bconst\b|\blet\b|\bvar\b/.test(trimmed)) {
            return `${TRIPLE_BACKTICK}javascript\n${trimmed}\n${TRIPLE_BACKTICK}`;
        }

        return trimmed;
    }
}
