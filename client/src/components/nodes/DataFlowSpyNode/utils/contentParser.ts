/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

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

        return `\`\`\`json\n${trimmed}\n\`\`\``;
    } catch {
        if (/<html[\s\S]*?>[\s\S]*<\/html>/i.test(trimmed) || /<body[\s\S]*?>[\s\S]*<\/body>/i.test(trimmed)) {
            return `\`\`\`html\n${trimmed}\n\`\`\``;
        }

        if (/function\s*\(|=>|\bconst\b|\blet\b|\bvar\b/.test(trimmed)) {
            return `\`\`\`javascript\n${trimmed}\n\`\`\``;
        }

        return trimmed;
    }
}

function csvToMarkdownTable (csvString: string): string | null {
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
