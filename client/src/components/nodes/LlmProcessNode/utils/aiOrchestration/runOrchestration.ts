/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Message, MessageRole} from "../../../../../types/ollama.types";
import {getExpectedOutputType, llmResponseJsonParse, parseFormat} from "../formatUtils";
import {AgentTaskResult, OrchestrationParams, OrchestrationResult, OrchestratorPlan} from "./types";
import {buildAggregationMessage, buildDependencyContext} from "./messageBuilders";
import {runSingleCall} from "./runSingleCall";
import {buildToolsDescription, resolveTaskTools} from "./toolResolution";

/** Fixed JSON Schema used to constrain the orchestrator's planning response. */
const ORCHESTRATOR_PLAN_SCHEMA = {
    type: "object",
    properties: {
        tasks: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    content: {type: "string"},
                    systemPrompt: {type: "string"},
                    tools: {
                        type: "array",
                        items: {type: "string"},
                        description: "Exact names of tools this task needs. Omit or leave empty if none needed."
                    },
                    dependsOn: {
                        type: "array",
                        items: {type: "number"},
                        description: "Zero-based indices of earlier tasks (index < this task's position) whose output this task needs as input. Omit if independent."
                    }
                },
                required: ["content"]
            }
        }
    },
    required: ["tasks"]
};

export const JSON_SCHEMA_PROMPT_PREFIX = 'Your response must be valid JSON matching the following schema exactly:';

/**
 * When the input is an array:
 *  1. Planning call  — orchestrator (using the node's system prompt) decomposes
 *                      the array into a structured list of agent tasks.
 *  2. Sequential agent calls — one per task, independent, raw text output.
 *  3. Aggregation call — synthesises all task results into the final output,
 *                        applying the node's `format` schema if provided.
 *
 * Designed so that future string-based self-planning support can be added
 * inside this function without changing its public signature.
 */
export async function runOrchestration (params: OrchestrationParams): Promise<OrchestrationResult> {
    const {input, prompt, model, format, tools, maxToolRetries, think, temperature} = params;

    // ------------------------------------------------------------------
    // 1. Planning call
    // ------------------------------------------------------------------
    const planningSystemPrompt = prompt
        ? `${prompt}\n\n${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(ORCHESTRATOR_PLAN_SCHEMA, null, 4)}`
        : `${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(ORCHESTRATOR_PLAN_SCHEMA, null, 4)}`;

    const planningMessages: Message[] = [
        {role: MessageRole.SYSTEM, content: planningSystemPrompt},
        {
            role: MessageRole.USER,
            // eslint-disable-next-line max-len
            content: `Analyze the following input and decompose it into a list of individual tasks to be processed by separate agents. For each task provide: the content to process, an optional custom systemPrompt if the task requires specialized instructions, a tools array with the exact names of any tools that task needs (leave empty if none), and a dependsOn array with the zero-based indices of any earlier tasks whose output this task requires as input (only backward references allowed — a task can only reference tasks that appear before it in the list; omit if independent).${buildToolsDescription(tools)}\n\nInput:\n${JSON.stringify(input, null, 4)}`
        }
    ];

    /* #if LOGS */
    console.group("[AI Orchestration] Planning");
    console.log("Input:", input);
    /* #endif */

    // No tools passed to the planning call — format-constrained JSON output and
    // tool_calls are mutually exclusive. Tool availability is described in the prompt.
    const planningResponse = await runSingleCall({
        messages: planningMessages,
        model,
        format: ORCHESTRATOR_PLAN_SCHEMA,
        maxToolRetries,
        think,
        temperature,
    });

    if (!planningResponse.success) {
        console.error("Planning failed:", planningResponse.error);
        console.groupEnd();

        return {success: false, error: `Orchestrator planning failed: ${planningResponse.error}`};
    }

    let plan: OrchestratorPlan;

    try {
        plan = llmResponseJsonParse(planningResponse.reply) as OrchestratorPlan;

        const totalTasks = plan.tasks.length;

        plan.tasks = plan.tasks.filter(t => typeof t.content === "string" && t.content.trim() !== "");

        if (plan.tasks.length < totalTasks) {
            console.warn(`[AI Orchestration] Dropped ${totalTasks - plan.tasks.length} empty task(s) from plan.`);
        }

        if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
            console.error("Orchestrator returned an empty task list.");
            console.groupEnd();

            return {success: false, error: "Orchestrator returned an empty task list."};
        }
    } catch (e) {
        console.error("Failed to parse plan:", planningResponse.reply);
        console.groupEnd();

        return {
            success: false,
            error: `Failed to parse orchestrator plan: ${e instanceof Error ? e.message : String(e)}`
        };
    }

    /* #if LOGS */
    console.log(`Plan: ${plan.tasks.length} task(s)`, plan.tasks);
    console.groupEnd();
    /* #endif */

    // ------------------------------------------------------------------
    // 2. Sequential agent calls
    // ------------------------------------------------------------------
    const taskResults: AgentTaskResult[] = [];

    for (let i = 0; i < plan.tasks.length; i++) {
        const task = plan.tasks[i];

        /* #if LOGS */
        console.group(`[AI Orchestration] Agent ${i + 1}/${plan.tasks.length}`);
        console.log("Task:", task.content);

        if (task.systemPrompt) {
            console.log("Custom system prompt:", task.systemPrompt);
        }
        /* #endif */

        const agentSystemPrompt = task.systemPrompt || prompt;
        const dependencyContext = buildDependencyContext(task, i, taskResults);

        /* #if LOGS */
        if (dependencyContext) {
            console.log(
                "Depends on task(s):",
                task.dependsOn
                    ?.filter(idx => idx >= 0 && idx < i)
                    .map(idx => `#${idx + 1} "${taskResults[idx].task.content.substring(0, 60)}${taskResults[idx].task.content.length > 60 ? "…" : ""}"`)
            );
        }
        /* #endif */

        const agentMessages: Message[] = [
            ...(agentSystemPrompt ? [{role: MessageRole.SYSTEM, content: agentSystemPrompt}] : []),
            {role: MessageRole.USER, content: `${dependencyContext}${task.content}`}
        ];

        // Only pass the tools the orchestrator decided this task needs.
        // requireToolUse on each tool is preserved from the original user config.
        const taskTools = resolveTaskTools(task, tools);

        /* #if LOGS */
        if (taskTools && taskTools.length > 0) {
            console.log(
                "Tools assigned:",
                taskTools.map(t => `${t.schema.name}${t.systemUserConfigValues.requireToolUse ? " (required)" : " (optional)"}`)
            );
        }
        /* #endif */

        const agentResponse = await runSingleCall({
            messages: agentMessages,
            model,
            // No format on individual calls — raw text output keeps things flexible
            tools: taskTools,
            maxToolRetries,
            think,
            temperature,
        });

        if (!agentResponse.success) {
            console.error("Agent failed:", agentResponse.error);
            console.groupEnd();

            return {
                success: false,
                error: `Agent call failed for task "${task.content.substring(0, 60)}...": ${agentResponse.error}`
            };
        }

        /* #if LOGS */
        console.log("Response:", agentResponse.reply);
        console.groupEnd();
        /* #endif */

        taskResults.push({task, response: agentResponse.reply});
    }

    // ------------------------------------------------------------------
    // 3. Aggregation call
    // ------------------------------------------------------------------
    /* #if LOGS */
    console.group("[AI Orchestration] Aggregation");
    console.log("Aggregating", taskResults.length, "result(s):", taskResults.map(r => ({task: r.task.content, response: r.response})));
    /* #endif */

    let parsedFormat: object | undefined;
    let onErrorValidator: ((data: any) => boolean) | undefined;

    try {
        ({parsedFormat, onErrorValidator} = parseFormat(format));
    } catch (e) {
        console.error("Invalid aggregation format schema:", e);
        console.groupEnd();

        return {
            success: false,
            error: `Invalid aggregation format schema: ${e instanceof Error ? e.message : String(e)}`
        };
    }

    const aggregationSystemPrompt = parsedFormat
        ? `${ prompt
            ? `${prompt}\n\n`
            : "" }${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(parsedFormat, null, 4)}`
        : prompt;


    const aggregationMessages: Message[] = [
        ...(aggregationSystemPrompt ? [{role: MessageRole.SYSTEM, content: aggregationSystemPrompt}] : []),
        {role: MessageRole.USER, content: buildAggregationMessage(taskResults)}
    ];

    // Aggregation has all task results in-context — no tools needed.
    const aggregationResponse = await runSingleCall({
        messages: aggregationMessages,
        model,
        ...(parsedFormat ? {format: parsedFormat} : {}),
        maxToolRetries,
        think,
        temperature,
    });

    if (!aggregationResponse.success) {
        console.error("Aggregation call failed:", aggregationResponse.error);
        console.groupEnd();

        return {success: false, error: `Aggregation call failed: ${aggregationResponse.error}`};
    }

    let result: any = aggregationResponse.reply;

    try {
        const expectedOutputType = getExpectedOutputType(parsedFormat);

        if (expectedOutputType === "object" || expectedOutputType === "array") {
            result = llmResponseJsonParse(result);

            if (expectedOutputType === "object" && onErrorValidator && onErrorValidator(result)) {
                return {
                    success: false,
                    error: `Aggregation LLM returned an error response matching onError schema:\n${JSON.stringify(result, null, 4)}`
                };
            }
        }
    } catch (e) {
        console.error("Failed to parse aggregation response:", aggregationResponse.reply);
        console.groupEnd();

        return {
            success: false,
            error: `Failed to parse aggregation response: ${e instanceof Error ? e.message : String(e)}`
        };
    }

    /* #if LOGS */
    console.log("Final result:", result);
    console.groupEnd();
    /* #endif */

    return {success: true, result};
}
