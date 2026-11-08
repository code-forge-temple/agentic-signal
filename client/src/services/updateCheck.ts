/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/** GitHub's latest published release: drafts and pre-releases are left out. */
export const LATEST_RELEASE_API = "https://api.github.com/repos/code-forge-temple/agentic-signal/releases/latest";

const TIMEOUT_MS = 10_000;

export type Release = {
    /** Without the tag's leading "v": "3.7.0". */
    version: string;
    url: string;
};

// "3.7.0", "v3.7.0" or "3.7.0-beta.1" → [3, 7, 0] and whether it's a pre-release; null for anything else.
function parseVersion (version: string): {numbers: number[]; preRelease: boolean} | null {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.exec(version.trim());

    return match ? {numbers: [Number(match[1]), Number(match[2]), Number(match[3])], preRelease: match[4] !== undefined} : null;
}

/** Whether `candidate` is a later version than `current`. A pre-release never counts as newer than its own release. */
export function isNewerVersion (candidate: string, current: string): boolean {
    const a = parseVersion(candidate);
    const b = parseVersion(current);

    if (!a || !b) return false;

    for (let i = 0; i < 3; i++) {
        if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i];
    }

    return !a.preRelease && b.preRelease;
}

/** The latest release on GitHub. Throws when GitHub can't be reached or answers with something else. */
export async function fetchLatestRelease (): Promise<Release> {
    const response = await fetch(LATEST_RELEASE_API, {
        headers: {Accept: "application/vnd.github+json"},
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);

    const body = await response.json() as {tag_name?: unknown; html_url?: unknown};

    if (typeof body.tag_name !== "string" || typeof body.html_url !== "string" || !parseVersion(body.tag_name)) {
        throw new Error("GitHub's answer has no release version");
    }

    return {version: body.tag_name.trim().replace(/^v/, ""), url: body.html_url};
}
