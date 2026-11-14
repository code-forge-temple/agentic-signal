/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TRIPLE_BACKTICK} from "@shared/constants";
import {csvToMarkdownTable} from "../../../utils";

// A CSV code block, its fence three backticks or more (group 1: an attached file's fence is longer than any run in it),
// up to the same fence.
const CSV_BLOCK_REGEX = /(`{3,})csv\s*([\s\S]*?)\1(?!`)/gi;
// Content that already has a code block of a language shown as is (a fence of three backticks or more).
const SHOWN_CODE_BLOCK_REGEX = /^`{3,}(json|js|javascript|html|md|markdown)[\s\S]*`{3,}$/m;

export function reformatContent (value: string): string {
    if (!value) return "";

    const trimmed = value.trim();

    if (trimmed.length > 50000) return trimmed;

    const csvConverted = trimmed.replace(CSV_BLOCK_REGEX, (match: string, _fence: string, csvContent: string) => {
        const table = csvToMarkdownTable(csvContent);

        return table || match;
    });

    if (csvConverted !== trimmed) {
        return csvConverted;
    }

    if (SHOWN_CODE_BLOCK_REGEX.test(trimmed)) {
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
