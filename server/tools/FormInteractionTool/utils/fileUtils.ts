/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {AttachedFile} from "../types.ts";

/**
 * Strips any directory components from a client-supplied file name so it can't
 * escape the temp directory via `../` or an absolute path when joined into a
 * destination path (`attachedFiles` is plain GraphQL input, not restricted to
 * files the user actually picked in the browser).
 */
function sanitizeFileName (name: string): string {
    const base = name.split(/[\\/]/).pop()?.replace(/^\.+/, "") || "";

    return base || "file";
}

/**
 * Writes base64-encoded files forwarded from the client to an isolated temp
 * directory. Returns the directory path and a map of filename → absolute path.
 * Caller is responsible for cleanup via `cleanupTempDir`.
 */
export async function writeTempFiles (attachedFiles: AttachedFile[]): Promise<{
    tempDir: string;
    pathMap: Record<string, string>;
}> {
    const tempDir = await Deno.makeTempDir({prefix: "form-interaction-"});
    const pathMap: Record<string, string> = {};
    const usedDestNames = new Set<string>();

    await Promise.all(
        attachedFiles.map(async (af, idx) => {
            let destName = sanitizeFileName(af.name);

            // Avoid clobbering another file when two attachments sanitize to the same name.
            if (usedDestNames.has(destName)) destName = `${idx}-${destName}`;
            usedDestNames.add(destName);

            const dest = `${tempDir}/${destName}`;
            const bytes = Uint8Array.from(atob(af.base64), (c) => c.charCodeAt(0));

            await Deno.writeFile(dest, bytes);
            // Keyed by the original (client-facing) name — that's what actions'
            // `fileKey` references, e.g. the file's original filename.
            pathMap[af.name] = dest;
        })
    );

    return {tempDir, pathMap};
}

/** Removes a temp directory created by `writeTempFiles`. Safe to call with `undefined`. */
export async function cleanupTempDir (tempDir: string | undefined): Promise<void> {
    if (tempDir) {
        await Deno.remove(tempDir, {recursive: true}).catch(() => {});
    }
}
