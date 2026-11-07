/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NODE_TYPE as WORKFLOW_INPUT_NODE_TYPE} from "../components/nodes/WorkflowInputNode/constants";
import {NODE_TYPE as LLM_NODE_TYPE} from "../components/nodes/LlmProcessNode/constants";
import {isRecord} from "../utils";


/** A command name as typed after "/" in the chat or in the URL: lowercase letters, digits and hyphens. */
const COMMAND_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type WorkflowCommand = {
    command: string;
    description: string;
};

/** "/Research " → "research"; empty when it isn't a valid command name. */
export function normalizeCommand (command: string): string {
    const name = command.trim().replace(/^\//, "").toLowerCase();

    return COMMAND_PATTERN.test(name) ? name : "";
}

/** The command a workflow answers to: its Workflow Input's, if it has one with a valid name. */
export function findWorkflowCommand (workflow: unknown): WorkflowCommand | null {
    const nodes = isRecord(workflow) && Array.isArray(workflow.nodes) ? workflow.nodes as unknown[] : [];

    for (const node of nodes) {
        if (!isRecord(node) || node.type !== WORKFLOW_INPUT_NODE_TYPE || !isRecord(node.data)) continue;

        const command = typeof node.data.command === "string" ? normalizeCommand(node.data.command) : "";

        if (command) {
            return {command, description: typeof node.data.description === "string" ? node.data.description : ""};
        }
    }

    return null;
}

/** The workflow with every LLM node that names no model set to `model` (the AI Buddy's, for a built-in). */
export function withDefaultModel (workflow: unknown, model: string): unknown {
    if (!isRecord(workflow) || !Array.isArray(workflow.nodes)) return workflow;

    return {
        ...workflow,
        nodes: (workflow.nodes as unknown[]).map((node) => {
            if (!isRecord(node) || node.type !== LLM_NODE_TYPE || !isRecord(node.data) || node.data.model) return node;

            return {...node, data: {...node.data, model}};
        }),
    };
}
