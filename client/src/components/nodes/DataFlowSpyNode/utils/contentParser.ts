/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export function reformatContent (value: string): string {
    if (!value) return "";

    const trimmed = value.trim();

    if(trimmed.length > 50000) return trimmed;

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