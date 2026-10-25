/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/**
 * Converts CSV text into a GFM Markdown table (for MarkdownRenderer), or returns null when it isn't
 * a regular table: fewer than two non-empty lines, or rows with differing column counts.
 * Comma-separated only, and a quoted value can't span lines (each line is parsed on its own).
 */
export function csvToMarkdownTable (csvString: string): string | null {
    const lines = csvString
        .trim()
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (lines.length < 2) return null;

    const rows = lines.map(parseCsvLine);
    const header = rows[0];

    if (!header.length || rows.some(row => row.length !== header.length)) {
        return null;
    }

    const formatRow = (cells: string[]) => `| ${cells.map(cell => cell.replace(/\|/g, '\\|').trim()).join(' | ')} |`;
    const divider = `| ${header.map(() => '---').join(' | ')} |`;

    return [formatRow(header), divider, ...rows.slice(1).map(formatRow)].join('\n');
}

function parseCsvLine (line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }

            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ',') {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());

    return values;
}
