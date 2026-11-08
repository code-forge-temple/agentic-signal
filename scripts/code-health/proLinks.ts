/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {existsSync, readdirSync, realpathSync} from "node:fs";
import path from "node:path";


/** Where agentic-signal-pro's link.sh / link.bat symlink the PRO nodes' code. */
const LINK_PARENTS = ["client/src/components/nodes", "server/nodes"];

export type ProLink = {
    /** The symlink, relative to this repo's root, with forward slashes: `client/src/components/nodes/SmsNode`. */
    link: string;
    /** The folder it points to, inside the PRO repo. */
    target: string;
};

export type ProLinks = {repo: string; links: ProLink[]};

const gitRoot = (start: string): string | null => {
    for (let dir = start; ; dir = path.dirname(dir)) {
        if (existsSync(path.join(dir, ".git"))) return dir;

        if (path.dirname(dir) === dir) return null;
    }
};

/** The PRO nodes linked into this repo, and the PRO repo they live in; null in a build without them. */
export function findProLinks (root: string): ProLinks | null {
    const links = LINK_PARENTS.flatMap((parent) => {
        const dir = path.join(root, parent);

        if (!existsSync(dir)) return [];

        return readdirSync(dir, {withFileTypes: true})
            .filter(entry => entry.isSymbolicLink())
            .map(entry => ({link: `${parent}/${entry.name}`, target: realpathSync(path.join(dir, entry.name))}));
    });
    const repo = links.length > 0 ? gitRoot(links[0].target) : null;

    return repo ? {repo, links} : null;
}
