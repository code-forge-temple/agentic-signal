/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {execFileSync} from "node:child_process";
import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import path from "node:path";
import {findProLinks, type ProLinks} from "./proLinks";


export const ROOT = path.resolve(import.meta.dir, "../..");

const SCANNED = ["client/src", "server", "shared", "scripts"];
const SKIPPED_DIRS = new Set(["node_modules", "dist", "build"]);
const posix = (file: string) => file.split(path.sep).join("/");

export const isScored = (file: string) => /\.tsx?$/.test(file) && !/\.gen\.|\.d\.ts$/.test(file);

// Through path.relative, which ignores case on Windows: a drive letter may come as h: or H:.
const isInside = (parent: string, child: string) => {
    const relative = path.relative(parent, child);

    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const pro: ProLinks | null = findProLinks(ROOT);

const git = (cwd: string, args: string[]): string | null => {
    try {
        return execFileSync("git", args, {cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024});
    } catch {
        return null;
    }
};

// Follows symlinks, so the linked PRO folders are walked like the rest.
const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const file = `${dir}/${name}`;

    if (SKIPPED_DIRS.has(name)) return [];

    return statSync(path.join(ROOT, file)).isDirectory() ? walk(file) : [file];
});

/** Every scored file: the TypeScript in client/src, server, shared and scripts, PRO links included. */
export const allFiles = (): string[] => SCANNED.filter(dir => existsSync(path.join(ROOT, dir))).flatMap(walk).filter(isScored);

/** A path in this repo (`client/src/...`) for an absolute one, a PRO repo file reached through its link; null outside. */
export function repoPath (absolute: string): string | null {
    const resolved = path.resolve(absolute);
    const link = pro?.links.find(({target}) => isInside(target, resolved));

    if (link) return `${link.link}/${posix(path.relative(link.target, resolved))}`;

    return isInside(ROOT, resolved) ? posix(path.relative(ROOT, resolved)) : null;
}

const changedIn = (repo: string): string[] => [
    ...(git(repo, ["diff", "--name-only", "HEAD"]) ?? "").split("\n"),
    ...(git(repo, ["ls-files", "--others", "--exclude-standard"]) ?? "").split("\n"),
].filter(Boolean).map(file => path.join(repo, file));

/** The scored files changed since the last commit, in this repo and in the PRO repo; deleted ones left out. */
export function changedFiles (): string[] {
    const absolute = [...changedIn(ROOT), ...(pro ? changedIn(pro.repo) : [])];
    const files = absolute.filter(existsSync).map(repoPath).filter((file): file is string => file !== null && isScored(file));

    return [...new Set(files)];
}

export const readText = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

/** The file as committed (in the PRO repo for a PRO file); null when it's new. */
export function headText (file: string): string | null {
    const link = pro?.links.find(({link: prefix}) => file.startsWith(`${prefix}/`));

    if (!link || !pro) return git(ROOT, ["show", `HEAD:${file}`]);

    const inPro = posix(path.relative(pro.repo, path.join(link.target, file.slice(link.link.length + 1))));

    return git(pro.repo, ["show", `HEAD:${inPro}`]);
}

const countChanges = (repo: string, since: string, counts: Map<string, number>) => {
    for (const line of (git(repo, ["log", `--since=${since}`, "--name-only", "--format="]) ?? "").split("\n").filter(Boolean)) {
        const file = repoPath(path.join(repo, line));

        if (file && isScored(file)) counts.set(file, (counts.get(file) ?? 0) + 1);
    }
};

/** How many commits changed each file since `since` (e.g. "6 months ago"), in both repos. */
export function changeCounts (since: string): Map<string, number> {
    const counts = new Map<string, number>();

    countChanges(ROOT, since, counts);

    if (pro) countChanges(pro.repo, since, counts);

    return counts;
}
