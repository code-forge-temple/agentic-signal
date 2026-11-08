/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// `eslint .` doesn't follow symlinks, so it never reaches the PRO nodes linked in from agentic-signal-pro. This lints the
// repo, then the linked PRO folders, each against its own repo's record of tolerated code-health violations
// (eslint-suppressions.json), so PRO file names stay out of this public repo. Arguments go to both runs.
import {spawnSync} from "node:child_process";
import path from "node:path";
import {findProLinks} from "./code-health/proLinks";


const ROOT = path.resolve(import.meta.dir, "..");
const ESLINT = path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js");
const SUPPRESSIONS = "eslint-suppressions.json";
const args = process.argv.slice(2);

const eslint = (targets: string[]): number => spawnSync("node", [ESLINT, ...targets, ...args], {cwd: ROOT, stdio: "inherit"}).status ?? 1;

let status = eslint(["."]);
const pro = findProLinks(ROOT);

if (pro) {
    console.log(`\nPRO nodes (${pro.links.length} linked folders), recorded in ${path.join(pro.repo, SUPPRESSIONS)}:`);
    status = Math.max(status, eslint([...pro.links.map(({link}) => link), "--suppressions-location", path.join(pro.repo, SUPPRESSIONS)]));
}

process.exit(status);
