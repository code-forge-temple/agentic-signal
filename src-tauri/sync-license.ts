/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// Writes src-tauri/LICENSE.txt from LICENSE.md: the license page the installers show before installing
// (tauri.conf.json's bundle.licenseFile). The page shows plain text, so the Markdown goes and only ASCII stays,
// which every installer reads correctly. Generated at each build, so it can't drift from LICENSE.md.

const SOURCE = "LICENSE.md";
const TARGET = "src-tauri/LICENSE.txt";

const ASCII_FOR: Record<string, string> = {"©": "(C)", "®": "(R)", "™": "(TM)", "—": "-", "–": "-", "‘": "'", "’": "'", "“": "\"", "”": "\"", "…": "...", " ": " "};

function toPlainText (markdown: string): string {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n").map((line) => {
        const text = line
            .replace(/[©®™—–‘’“”… ]/g, (char) => ASCII_FOR[char])
            .replace(/\p{Extended_Pictographic}️?\s?/gu, "")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
            .replace(/\*\*|__|`/g, "")
            .trimEnd();

        if (/^-{3,}$/.test(text)) return "-".repeat(40);

        const heading = /^(#{1,6})\s+(.*)$/.exec(text);

        if (!heading) return text;

        const [, level, title] = heading;

        if (level.length === 1) return `${title}\n${"=".repeat(title.length)}`;

        if (level.length === 2) return `${title}\n${"-".repeat(title.length)}`;

        return title;
    });

    const plain = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    // eslint-disable-next-line no-control-regex
    const leftover = [...new Set(plain.match(/[^\x00-\x7F]/g) ?? [])];

    if (leftover.length > 0) console.warn(`${TARGET}: dropped characters the installer can't show: ${leftover.join(" ")}`);

    // eslint-disable-next-line no-control-regex
    return `${plain.replace(/[^\x00-\x7F]/g, "")}\n`.replace(/\n/g, "\r\n");
}

await Deno.writeTextFile(TARGET, toPlainText(await Deno.readTextFile(SOURCE)));
console.log(`Wrote ${TARGET} from ${SOURCE}`);
