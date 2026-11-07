/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {join} from "node:path";
import {browserCandidates, detectBrowserPath} from "./service.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

Deno.test("finds the first browser candidate that exists, and null when none does", async () => {
    const root = await Deno.makeTempDir({prefix: "browser-test-"});

    try {
        await Deno.mkdir(join(root, "folder"));

        for (const file of ["a.exe", "z.exe"]) await Deno.writeTextFile(join(root, file), "");

        assertEquals(await detectBrowserPath([join(root, "missing.exe"), join(root, "a.exe"), join(root, "z.exe")]), join(root, "a.exe"));
        assertEquals(await detectBrowserPath([join(root, "missing.exe"), join(root, "folder")]), null);
    } finally {
        await Deno.remove(root, {recursive: true});
    }
});

Deno.test("looks for Chrome where this system installs it", () => {
    const candidates = browserCandidates();
    const expected = {windows: /chrome\.exe$/, darwin: /Google Chrome$/}[Deno.build.os as string] ?? /chrom/;

    if (candidates.length === 0 || !candidates.every(candidate => expected.test(candidate))) throw new Error(`Unexpected candidates ${candidates}`);
});
