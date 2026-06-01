/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {AgentTask, AgentTaskResult} from "./types";

/**
 * Builds a context block injected into an agent's prompt when it depends on prior task outputs.
 * Only backward references (index < taskIndex) are accepted; forward/invalid refs are warned and skipped.
 */
export function buildDependencyContext (
    task: AgentTask,
    taskIndex: number,
    completedResults: AgentTaskResult[]
): string {
    if (!task.dependsOn || task.dependsOn.length === 0) return "";

    const invalid = task.dependsOn.filter(i => i < 0 || i >= taskIndex);

    if (invalid.length > 0) {
        console.warn(
            `[AI Orchestration] Task ${taskIndex + 1} has invalid dependsOn indices (must be < ${taskIndex}, ignored): ${invalid.join(", ")}`
        );
    }

    const validIndices = task.dependsOn.filter(i => i >= 0 && i < taskIndex);

    if (validIndices.length === 0) return "";

    const sections = validIndices.map(i =>
        `### Output of Task ${i + 1}\n${completedResults[i].response}`
    );

    return `[CONTEXT FROM PRIOR TASKS]\n${sections.join("\n\n")}\n\n[YOUR TASK]\n`;
}

export function buildAggregationMessage (results: AgentTaskResult[]): string {
    const sections = results.map((r, i) =>
        `## Task ${i + 1}\n**Request:** ${r.task.content}\n**Response:** ${r.response}`
    );

    return `The following are the results of individual agent tasks. Synthesize them into a final comprehensive response.\n\n${sections.join("\n\n")}`;
}
