/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// bun run health: scores each TypeScript file 1-10 from the code-health rules in eslint.code-health.js.
//   (no option)            the whole repo: average, bands, the lowest files
//   --changed              changed files against the last commit: before → after, new problems
//   --files <file> ...     the same for the files named
//   --fail-on-regression   with --changed or --files: exit 1 when a file got worse
//   --hotspots             files that change often and score low
//   --json                 machine-readable output
//   --top <n>              how many files the lists show (default 20)
//   --hook <after-edit|stop>  run as a Claude Code hook (reads the hook's JSON on stdin)
import {allFiles, changedFiles, changeCounts, repoPath} from "./code-health/files";
import {fileChange, fileHealth, inSequence} from "./code-health/health";
import {runHook} from "./code-health/hook";
import {changeReport, hotspotReport, repoReport} from "./code-health/report";


const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (flag: string) => (has(flag) ? args[args.indexOf(flag) + 1] : undefined);
const top = Number(valueOf("--top") ?? 20);

// The files after --files, up to the next option.
const namedFiles = (): string[] => {
    const start = args.indexOf("--files") + 1;
    const end = args.findIndex((arg, index) => index >= start && arg.startsWith("--"));

    return args.slice(start, end === -1 ? undefined : end).map(file => repoPath(file) ?? file);
};

const print = (json: unknown, text: string) => console.log(has("--json") ? JSON.stringify(json, null, 4) : text);

async function changes (): Promise<number> {
    const results = await inSequence(has("--files") ? namedFiles() : changedFiles(), fileChange);

    print(results, changeReport(results));

    return has("--fail-on-regression") && results.some(change => change.regression) ? 1 : 0;
}

async function repo (): Promise<number> {
    const results = await inSequence(allFiles(), file => fileHealth(file));

    if (has("--hotspots")) print(results, hotspotReport(results, changeCounts("6 months ago"), top));
    else print(results, repoReport(results, top));

    return 0;
}

async function main (): Promise<number> {
    const hook = valueOf("--hook");

    if (hook) return runHook(hook);

    return has("--changed") || has("--files") ? changes() : repo();
}

process.exit(await main());
