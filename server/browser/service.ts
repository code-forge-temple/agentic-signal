/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {join} from "node:path";


function homeFolder (): string {
    return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? Deno.cwd();
}

/** Where Chrome (or Chromium) usually lives on this system, in the order to look. */
export function browserCandidates (): string[] {
    switch (Deno.build.os) {
        case "windows": {
            const bases = [Deno.env.get("ProgramFiles"), Deno.env.get("ProgramFiles(x86)"), Deno.env.get("LOCALAPPDATA")];

            return bases.filter((base): base is string => !!base).map(base => join(base, "Google", "Chrome", "Application", "chrome.exe"));
        }
        case "darwin":
            return [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                join(homeFolder(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
            ];
        default:
            return ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];
    }
}

/**
 * The first browser found in its usual place, or null. The backend runs the browser, so it looks on
 * its own disk, which in Docker is the container's.
 */
export async function detectBrowserPath (candidates: string[] = browserCandidates()): Promise<string | null> {
    for (const candidate of candidates) {
        if ((await Deno.stat(candidate).catch(() => null))?.isFile) return candidate;
    }

    return null;
}
