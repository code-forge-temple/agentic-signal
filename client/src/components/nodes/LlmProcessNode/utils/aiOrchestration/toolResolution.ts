/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {AgentTask, OrchestrationParams} from "./types";

/** Returns a human-readable list of available tools for injection into the planning prompt. */
export function buildToolsDescription (tools: OrchestrationParams["tools"]): string {
    if (!tools || tools.length === 0) return "";

    const list = tools
        .map(t => `- ${t.schema.name}${t.schema.description ? ": " + t.schema.description : ""}`)
        .join("\n");

    return `\n\nAvailable tools (use exact names when assigning to tasks):\n${list}`;
}

/** Strips all non-alphanumeric characters and lowercases — used for tier-3 fuzzy matching. */
function normalizeName (name: string): string {
    return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * Resolves a single planner-supplied tool name against the registered tools list.
 * Three tiers in order of confidence:
 *   1. Exact match
 *   2. Case-insensitive match
 *   3. Normalized match (strips non-alphanumeric, lowercases both sides)
 * Returns the matched tool entry and the tier label, or null if unresolvable.
 */
function resolveToolName (
    name: string,
    allTools: NonNullable<OrchestrationParams["tools"]>
): { tool: NonNullable<OrchestrationParams["tools"]>[number]; tier: string } | null {
    // Tier 1 — exact
    const exact = allTools.find(t => t.schema.name === name);

    if (exact) return {tool: exact, tier: "exact"};

    // Tier 2 — case-insensitive
    const lower = name.toLowerCase();
    const caseInsensitive = allTools.find(t => t.schema.name.toLowerCase() === lower);

    if (caseInsensitive) return {tool: caseInsensitive, tier: "case-insensitive"};

    // Tier 3 — normalized (strip punctuation/separators, lowercase)
    const norm = normalizeName(name);
    const normalized = allTools.find(t => normalizeName(t.schema.name) === norm);

    if (normalized) return {tool: normalized, tier: "normalized"};

    return null;
}

/**
 * Filters the full tools array down to only those the orchestrator assigned to a task.
 * Uses tiered fuzzy matching (exact → case-insensitive → normalized) so minor
 * hallucinations (wrong casing, extra separators) are corrected rather than dropped.
 * Genuinely unresolvable names are logged and ignored.
 * The original requireToolUse flag on each tool is preserved.
 */
export function resolveTaskTools (
    task: AgentTask,
    allTools: OrchestrationParams["tools"]
): OrchestrationParams["tools"] {
    if (!allTools || allTools.length === 0 || !task.tools || task.tools.length === 0) return undefined;

    const resolved: NonNullable<OrchestrationParams["tools"]> = [];

    for (const name of task.tools) {
        const match = resolveToolName(name, allTools);

        if (match) {
            if (match.tier !== "exact") {
                console.warn(
                    `[AI Orchestration] Tool name fuzzy-resolved: "${name}" → "${match.tool.schema.name}" (${match.tier} match)`
                );
            }

            // Avoid duplicates if the planner listed the same tool twice
            if (!resolved.includes(match.tool)) {
                resolved.push(match.tool);
            }
        } else {
            console.warn(`[AI Orchestration] Tool name unresolvable, ignored: "${name}" (no match found in [${allTools.map(t => t.schema.name).join(", ")}])`);
        }
    }

    return resolved.length > 0 ? resolved : undefined;
}
