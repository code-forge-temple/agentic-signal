/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {sanitizeJsonInput} from '../../../../nodes/ToolNode/tools/utils/sanitize';


// One answer per block, since the chat redraws its replies again and again; the oldest goes first.
const MAX_REMEMBERED_BLOCKS = 100;
const workflowByBlock = new Map<string, string | null>();

function parseWorkflow (codeBlock: string): string | null {
    if (!codeBlock.trimStart().startsWith('{')) return null;

    let parsed: unknown;

    try {
        parsed = JSON.parse(codeBlock);
    } catch {
        // The forgiving parser (dirty-json) takes about 100 ms on a 15 KB workflow: only for JSON a model got
        // slightly wrong, such as a trailing comma.
        try {
            parsed = sanitizeJsonInput(codeBlock);
        } catch {
            return null;
        }
    }

    const candidate = parsed as {nodes?: unknown; workflow?: {nodes?: unknown}} | null;

    if (Array.isArray(candidate?.nodes)) return JSON.stringify(candidate, null, 4);

    if (candidate?.workflow && Array.isArray(candidate.workflow.nodes)) return JSON.stringify(candidate.workflow, null, 4);

    return null;
}

/** The workflow in a reply's code block, formatted, or null when the block isn't one. */
export function findWorkflowJson (codeBlock: string): string | null {
    const remembered = workflowByBlock.get(codeBlock);

    if (remembered !== undefined) return remembered;

    const found = parseWorkflow(codeBlock);

    if (workflowByBlock.size >= MAX_REMEMBERED_BLOCKS) {
        const oldest = workflowByBlock.keys().next().value;

        if (oldest !== undefined) workflowByBlock.delete(oldest);
    }

    workflowByBlock.set(codeBlock, found);

    return found;
}
