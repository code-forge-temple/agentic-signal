/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {basename, dirname, isAbsolute, join, resolve} from "node:path";


// Plain names only (no path separators), ending in .json: the backend is reachable from the network,
// so it never touches anything but workflow files directly inside the folder.
const WORKFLOW_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._()-]*\.json$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type WorkflowFile = {
    name: string;
    content: string;
};

export type WorkflowsFolder = {
    path: string;
    files: WorkflowFile[];
};

/** Where workflows live when Settings names no folder: AGENTIC_SIGNAL_WORKFLOWS_DIR, else ~/.agentic-signal/workflows. */
export function defaultWorkflowsFolder (): string {
    const fromEnv = Deno.env.get("AGENTIC_SIGNAL_WORKFLOWS_DIR");

    if (fromEnv) return resolve(fromEnv);

    const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? Deno.cwd();

    return join(home, ".agentic-signal", "workflows");
}

/** The folder from Settings, which must exist, or the default one, created on first use. */
export async function resolveWorkflowsFolder (folder?: string | null): Promise<string> {
    const given = folder?.trim();

    if (!given) {
        const path = defaultWorkflowsFolder();

        await Deno.mkdir(path, {recursive: true});

        return path;
    }

    if (!isAbsolute(given)) throw new Error(`The workflows folder must be a full path, not "${given}".`);

    const path = resolve(given);
    const info = await Deno.stat(path).catch(() => null);

    if (!info?.isDirectory) throw new Error(`The workflows folder "${path}" doesn't exist.`);

    return path;
}

function workflowFilePath (folder: string, name: string): string {
    if (!WORKFLOW_FILE_NAME.test(name) || basename(name) !== name) {
        throw new Error(`"${name}" isn't a workflow file name: letters, digits, spaces, dots, dashes and brackets, ending in .json.`);
    }

    const path = join(folder, name);

    if (dirname(path) !== folder) throw new Error(`"${name}" would land outside the workflows folder.`);

    return path;
}

/** Every workflow file in the folder, with its content, by name. */
export async function listWorkflows (folder?: string | null): Promise<WorkflowsFolder> {
    const path = await resolveWorkflowsFolder(folder);
    const files: WorkflowFile[] = [];

    for await (const entry of Deno.readDir(path)) {
        if (!entry.isFile || !WORKFLOW_FILE_NAME.test(entry.name)) continue;

        const filePath = join(path, entry.name);
        const {size} = await Deno.stat(filePath);

        if (size > MAX_FILE_BYTES) continue;

        files.push({name: entry.name, content: await Deno.readTextFile(filePath)});
    }

    files.sort((a, b) => a.name.localeCompare(b.name));

    return {path, files};
}

/** Writes a workflow into the folder, replacing a file of the same name. Returns the file's full path. */
export async function saveWorkflow (folder: string | null | undefined, name: string, content: string): Promise<string> {
    try {
        JSON.parse(content);
    } catch {
        throw new Error("The workflow isn't valid JSON.");
    }

    const filePath = workflowFilePath(await resolveWorkflowsFolder(folder), name);

    await Deno.writeTextFile(filePath, content);

    return filePath;
}
