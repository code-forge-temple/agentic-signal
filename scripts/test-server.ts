/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// `deno test server/` doesn't follow symlinks, so it never runs the tests of the PRO nodes linked in from
// agentic-signal-pro. This runs the server's tests (`deno task test`) with the linked PRO server folders added.
import {spawnSync} from "node:child_process";
import path from "node:path";
import {findProLinks} from "./code-health/proLinks";


const ROOT = path.resolve(import.meta.dir, "..");
const proServerFolders = (findProLinks(ROOT)?.links ?? []).map(({link}) => link).filter(link => link.startsWith("server/"));
const deno = spawnSync("deno", ["task", "test", ...proServerFolders, ...process.argv.slice(2)], {cwd: ROOT, stdio: "inherit"});

process.exit(deno.status ?? 1);
