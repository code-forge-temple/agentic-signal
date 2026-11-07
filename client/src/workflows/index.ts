/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import convert from "./builtin/convert.json";
import cryptoAnalysis from "./builtin/crypto.json";
import holidays from "./builtin/holidays.json";
import research from "./builtin/research.json";
import summarize from "./builtin/summarize.json";
import weather from "./builtin/weather.json";
import {findWorkflowCommand, WorkflowCommand} from "./commands";


export {findWorkflowCommand, normalizeCommand, withDefaultModel} from "./commands";

export type {WorkflowCommand} from "./commands";

/** Dispatched on window after a workflow is saved to the folder, so the command list catches up. */
export const WORKFLOWS_CHANGED_EVENT = "agentic-signal:workflows-changed";

export type CommandWorkflow = WorkflowCommand & {
    workflow: unknown;
    /** The file it was saved as; none for a built-in. */
    file?: string;
};

export type WorkflowFile = {
    name: string;
    content: string;
};

/** Workflows that ship with the app, callable from the chat as /<command>. */
export const BUILTIN_COMMAND_WORKFLOWS: CommandWorkflow[] = [convert, cryptoAnalysis, holidays, research, summarize, weather].flatMap((workflow) => {
    const found = findWorkflowCommand(workflow);

    return found ? [{...found, workflow}] : [];
});

/** The chat's commands: the built-ins, each replaced by a saved workflow answering to the same command. */
export function commandWorkflowsFrom (files: WorkflowFile[]): CommandWorkflow[] {
    const byCommand = new Map(BUILTIN_COMMAND_WORKFLOWS.map(w => [w.command, w]));
    const saved = new Set<string>();

    for (const file of files) {
        let workflow: unknown;

        try {
            workflow = JSON.parse(file.content);
        } catch {
            continue;
        }

        const found = findWorkflowCommand(workflow);

        // Two saved files answering to one command: the first by name wins.
        if (!found || saved.has(found.command)) continue;

        saved.add(found.command);
        byCommand.set(found.command, {...found, workflow, file: file.name});
    }

    return [...byCommand.values()].sort((a, b) => a.command.localeCompare(b.command));
}

/** A layer's name as a workflow file name the backend accepts: "Layer 1" → "Layer 1.json". */
export function workflowFileName (layerName: string): string {
    const base = layerName.trim().replace(/[^A-Za-z0-9 ._()-]/g, "-").replace(/^[^A-Za-z0-9]+/, "").replace(/\.json$/i, "");

    return `${base || "workflow"}.json`;
}

/** A workflow file's name as a layer name: "research.json" → "research". */
export function layerNameFromFileName (fileName: string): string {
    return fileName.replace(/\.json$/i, "").trim();
}
