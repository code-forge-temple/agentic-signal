/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/**
 * The desktop app's own open-file dialog for a workflow, starting in `folder`: the chosen file's name and text,
 * or null when cancelled. Only the picked file can be read: the dialog grants the fs plugin just that path.
 */
export async function openWorkflowFileNatively (folder?: string): Promise<{fileName: string; json: string} | null> {
    // Loaded on first use: the browser build never needs them.
    const [{open}, {readTextFile}] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
    const picked = await open({
        title: "Load Workflow",
        defaultPath: folder,
        multiple: false,
        directory: false,
        filters: [{name: "Workflow", extensions: ["json"]}],
    });

    if (typeof picked !== "string") return null;

    return {fileName: picked.split(/[\\/]/).pop() ?? picked, json: await readTextFile(picked)};
}
