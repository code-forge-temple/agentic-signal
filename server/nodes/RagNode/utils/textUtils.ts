/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export function chunkText (text: string, chunkSize: number, overlap: number): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const chunks: string[] = [];

    if (words.length === 0) return chunks;

    const step = Math.max(1, chunkSize - overlap);
    let i = 0;

    while (i < words.length) {
        chunks.push(words.slice(i, i + chunkSize).join(" "));
        i += step;
    }

    return chunks;
}

export async function hashString (str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
