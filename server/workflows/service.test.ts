/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {join} from "node:path";
import {listWorkflows, resolveWorkflowsFolder, saveWorkflow} from "./service.ts";
import {errorMessage} from "../../shared/utils.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

async function assertRejects (fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
    try {
        await fn();
    } catch (error) {
        const message = errorMessage(error);

        if (!pattern.test(message)) throw new Error(`Rejected with "${message}", expected ${pattern}`);

        return;
    }

    throw new Error(`Expected a rejection matching ${pattern}`);
}

async function withFolder (run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await Deno.makeTempDir({prefix: "workflows-test-"});

    try {
        await run(folder);
    } finally {
        await Deno.remove(folder, {recursive: true});
    }
}

Deno.test("lists the workflow files directly in the folder, by name, with their content", () => withFolder(async (folder) => {
    await Deno.writeTextFile(join(folder, "b.json"), "{\"nodes\":[]}");
    await Deno.writeTextFile(join(folder, "a.json"), "{}");
    await Deno.writeTextFile(join(folder, "notes.txt"), "not a workflow");
    await Deno.mkdir(join(folder, "nested.json"));

    const listed = await listWorkflows(folder);

    assertEquals(listed.path, folder);
    assertEquals(listed.files, [{name: "a.json", content: "{}"}, {name: "b.json", content: "{\"nodes\":[]}"}]);
}));

Deno.test("saves a workflow, replacing one of the same name", () => withFolder(async (folder) => {
    const path = await saveWorkflow(folder, "My Research.json", "{\"v\":1}");

    assertEquals(path, join(folder, "My Research.json"));

    await saveWorkflow(folder, "My Research.json", "{\"v\":2}");

    assertEquals(await Deno.readTextFile(path), "{\"v\":2}");
}));

Deno.test("refuses content that isn't JSON", () => withFolder(async (folder) => {
    await assertRejects(() => saveWorkflow(folder, "bad.json", "{oops"), /isn't valid JSON/);
}));

Deno.test("refuses names that would leave the folder or aren't .json files", () => withFolder(async (folder) => {
    for (const name of ["../escape.json", "sub/inner.json", "sub\\inner.json", "script.js", ".hidden.json", "..json"]) {
        await assertRejects(() => saveWorkflow(folder, name, "{}"), /isn't a workflow file name|outside the workflows folder/);
    }
}));

Deno.test("needs a folder from Settings to be a full path that exists", async () => {
    await assertRejects(() => resolveWorkflowsFolder("relative/folder"), /must be a full path/);
    await assertRejects(() => resolveWorkflowsFolder(join(Deno.cwd(), "no-such-folder-xyz")), /doesn't exist/);
});

Deno.test("creates the default folder (AGENTIC_SIGNAL_WORKFLOWS_DIR) on first use", () => withFolder(async (folder) => {
    const target = join(folder, "fresh", "workflows");
    const previous = Deno.env.get("AGENTIC_SIGNAL_WORKFLOWS_DIR");

    Deno.env.set("AGENTIC_SIGNAL_WORKFLOWS_DIR", target);

    try {
        assertEquals(await resolveWorkflowsFolder(""), target);
        assertEquals((await Deno.stat(target)).isDirectory, true);
    } finally {
        if (previous === undefined) Deno.env.delete("AGENTIC_SIGNAL_WORKFLOWS_DIR");
        else Deno.env.set("AGENTIC_SIGNAL_WORKFLOWS_DIR", previous);
    }
}));
