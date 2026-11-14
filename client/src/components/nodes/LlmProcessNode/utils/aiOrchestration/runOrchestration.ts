/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Message, MessageRole} from "../../../../../services/llm/types";
import {getExpectedOutputType, llmResponseJsonParse, ParsedFormat, serializeInput} from "../formatUtils";
import {AgentTask, AgentTaskResult, OrchestrationParams, OrchestrationResult} from "./types";
import {buildAggregationMessage, buildDependencyContext, validDependencies} from "./messageBuilders";
import {runSingleCall} from "./runSingleCall";
import {buildToolsDescription, resolveTaskTools} from "./toolResolution";
import {formatErrorMessage, isRecord} from "../../../../../utils/utils";
import {errorMessage} from "@shared/utils";

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

// eslint-disable-next-line max-len
const PLANNING_REQUEST = "Analyze the following input and decompose it into a list of individual tasks to be processed by separate agents. For each task provide: the content to process, an optional custom systemPrompt if the task requires specialized instructions, a tools array with the exact names of any tools that task needs (leave empty if none), and a dependsOn array with the zero-based indices of any earlier tasks whose output this task requires as input (only backward references allowed — a task can only reference tasks that appear before it in the list; omit if independent).";

type Failure = {success: false; error: string};

const failure = (error: string): Failure => ({success: false, error});

const isFailure = (value: unknown): value is Failure => typeof value === "object" && value !== null && (value as Failure).success === false;

/** What every call of the run sends besides its messages, tools and format. */
const callSettings = ({model, maxToolRetries, think, temperature, signal}: OrchestrationParams) =>
    ({model, maxToolRetries, think, temperature, signal});

/** `prompt`, when there is one, followed by the instruction to answer as JSON matching `schema`. */
const withSchema = (prompt: string | undefined, schema: object) =>
    `${prompt ? `${prompt}\n\n` : ""}${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(schema, null, 4)}`;

/** A system message when there's a system prompt, then the user's message. */
const promptMessages = (systemPrompt: string | undefined, userContent: string): Message[] => [
    ...(systemPrompt ? [{role: MessageRole.SYSTEM, content: systemPrompt}] : []),
    {role: MessageRole.USER, content: userContent},
];

type PlannedTask = Record<string, unknown> & {content: string};

const hasContent = (task: unknown): task is PlannedTask => isRecord(task) && typeof task.content === "string" && task.content.trim() !== "";

/**
 * A planned task as the agents can use it: its content, and its other fields only where they have a task's types, so
 * a model's malformed JSON (a `dependsOn` of 1, `tools` as one string) can't break the steps that read them.
 */
function asAgentTask (task: PlannedTask): AgentTask {
    return {
        content: task.content,
        ...(typeof task.systemPrompt === "string" ? {systemPrompt: task.systemPrompt} : {}),
        ...(Array.isArray(task.tools) ? {tools: task.tools.filter((tool): tool is string => typeof tool === "string")} : {}),
        // Its entries are left as they are: buildDependencyContext warns about and ignores those that are no task index.
        ...(Array.isArray(task.dependsOn) ? {dependsOn: task.dependsOn as number[]} : {}),
    };
}

const isPlanIndex = (index: unknown, taskCount: number) => Number.isInteger(index) && (index as number) >= 0 && (index as number) < taskCount;

/**
 * `dependsOn` pointed at the tasks that are left: a kept task's index becomes its new one, a dropped task's goes (it had
 * nothing to pass on), and anything else the planner wrote stays for buildDependencyContext to turn down.
 */
function renumbered (task: AgentTask, taskIndex: number, {newIndexOf, taskCount}: {newIndexOf: Map<number, number>; taskCount: number}): AgentTask {
    if (!task.dependsOn) return task;

    const dependsOn = task.dependsOn.flatMap((index) => {
        const newIndex = newIndexOf.get(index);

        if (newIndex !== undefined) return [newIndex];

        if (!isPlanIndex(index, taskCount)) return [index];

        console.warn(`[AI Orchestration] Task ${taskIndex + 1} depended on task ${index + 1} of the plan, which had no content and was dropped; that dependency is ignored.`);

        return [];
    });

    return {...task, dependsOn};
}

/** The tasks that have content, as agent tasks, each dependsOn still pointing at the same tasks as before. */
function withoutEmptyTasks (tasks: unknown[]): AgentTask[] {
    const newIndexOf = new Map<number, number>();
    const kept: AgentTask[] = [];

    tasks.forEach((task, index) => {
        if (!hasContent(task)) return;

        newIndexOf.set(index, kept.length);
        kept.push(asAgentTask(task));
    });

    if (kept.length === tasks.length) return kept;

    return kept.map((task, index) => renumbered(task, index, {newIndexOf, taskCount: tasks.length}));
}

/** The plan's tasks, empty ones dropped. A failure when the reply isn't a plan, or leaves no task. */
function parsePlan (reply: string): AgentTask[] | Failure {
    let plan: unknown;

    try {
        plan = llmResponseJsonParse(reply);
    } catch (e) {
        console.error("Failed to parse plan:", reply);

        return failure(`Failed to parse orchestrator plan: ${errorMessage(e)}`);
    }

    const tasks = isRecord(plan) ? plan.tasks : undefined;

    if (!Array.isArray(tasks)) {
        console.error("Failed to parse plan:", reply);

        return failure("Failed to parse orchestrator plan: it has no \"tasks\" list.");
    }

    const kept = withoutEmptyTasks(tasks);

    if (kept.length < tasks.length) {
        console.warn(`[AI Orchestration] Dropped ${tasks.length - kept.length} task(s) without content from plan.`);
    }

    if (kept.length === 0) {
        console.error("Orchestrator returned an empty task list.");

        return failure("Orchestrator returned an empty task list.");
    }

    return kept;
}

/** 1. Planning: the orchestrator, with the node's system prompt, splits the input into tasks for separate agents. */
async function planTasks (params: OrchestrationParams): Promise<AgentTask[] | Failure> {
    const {input, prompt, tools} = params;
    // A string input is used as-is; anything else (object, array, number, boolean) is
    // JSON-stringified. Prevents an already-string input from being re-wrapped in quotes
    // when embedded into the planning prompt below.
    const serializedInput = serializeInput(input) ?? String(input);

    /* #if LOGS */
    console.group("[AI Orchestration] Planning");
    console.log("Input:", input);
    /* #endif */

    try {
        // No tools passed to the planning call — format-constrained JSON output and
        // tool_calls are mutually exclusive. Tool availability is described in the prompt.
        const planningResponse = await runSingleCall({
            messages: promptMessages(withSchema(prompt, ORCHESTRATOR_PLAN_SCHEMA), `${PLANNING_REQUEST}${buildToolsDescription(tools)}\n\nInput:\n${serializedInput}`),
            ...callSettings(params),
            format: ORCHESTRATOR_PLAN_SCHEMA,
        });

        if (!planningResponse.success) {
            console.error("Planning failed:", planningResponse.error);

            return failure(`Orchestrator planning failed: ${planningResponse.error}`);
        }

        const tasks = parsePlan(planningResponse.reply);

        /* #if LOGS */
        if (Array.isArray(tasks)) console.log(`Plan: ${tasks.length} task(s)`, tasks);
        /* #endif */

        return tasks;
    } finally {
        /* #if LOGS */
        console.groupEnd();
        /* #endif */
    }
}

/* #if LOGS */
function logDependencies (task: AgentTask, i: number, taskResults: AgentTaskResult[]) {
    console.log(
        "Depends on task(s):",
        validDependencies(task, i)
            .map(idx => `#${idx + 1} "${taskResults[idx].task.content.substring(0, 60)}${taskResults[idx].task.content.length > 60 ? "…" : ""}"`)
    );
}

function logTools (taskTools: ReturnType<typeof resolveTaskTools>) {
    if (taskTools && taskTools.length > 0) {
        console.log(
            "Tools assigned:",
            taskTools.map(t => `${t.schema.name}${t.systemUserConfigValues.requireToolUse ? " (required)" : " (optional)"}`)
        );
    }
}
/* #endif */

/** One agent: its task, the outputs of the tasks it depends on, and only the tools the orchestrator gave it. */
async function runAgentTask (params: OrchestrationParams, tasks: AgentTask[], i: number, taskResults: AgentTaskResult[]): Promise<string | Failure> {
    const task = tasks[i];

    /* #if LOGS */
    console.group(`[AI Orchestration] Agent ${i + 1}/${tasks.length}`);
    console.log("Task:", task.content);

    if (task.systemPrompt) {
        console.log("Custom system prompt:", task.systemPrompt);
    }
    /* #endif */

    try {
        const dependencyContext = buildDependencyContext(task, i, taskResults);

        /* #if LOGS */
        if (dependencyContext) logDependencies(task, i, taskResults);
        /* #endif */

        // Only pass the tools the orchestrator decided this task needs.
        // requireToolUse on each tool is preserved from the original user config.
        const taskTools = resolveTaskTools(task, params.tools);

        /* #if LOGS */
        logTools(taskTools);
        /* #endif */

        const agentResponse = await runSingleCall({
            messages: promptMessages(task.systemPrompt || params.prompt, `${dependencyContext}${task.content}`),
            ...callSettings(params),
            // No format on individual calls — raw text output keeps things flexible
            tools: taskTools,
        });

        if (!agentResponse.success) {
            console.error("Agent failed:", agentResponse.error);

            return failure(`Agent call failed for task "${task.content.substring(0, 60)}...": ${agentResponse.error}`);
        }

        /* #if LOGS */
        console.log("Response:", agentResponse.reply);
        /* #endif */

        return agentResponse.reply;
    } finally {
        /* #if LOGS */
        console.groupEnd();
        /* #endif */
    }
}

/** 2. The agents, one task after the other; the first that fails ends the run. */
async function runAgentTasks (params: OrchestrationParams, tasks: AgentTask[]): Promise<AgentTaskResult[] | Failure> {
    const taskResults: AgentTaskResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
        const response = await runAgentTask(params, tasks, i, taskResults);

        if (isFailure(response)) return response;

        taskResults.push({task: tasks[i], response});
    }

    return taskResults;
}

const NO_FORMAT: ParsedFormat = {parsedFormat: undefined, onErrorValidator: undefined};

/**
 * The aggregation's result: its JSON when the format expects an object or an array, its text otherwise. A failure when
 * that JSON doesn't parse, or matches the format's onError schema.
 */
function readAggregation (reply: string, {parsedFormat, onErrorValidator}: ParsedFormat): OrchestrationResult {
    let result: unknown = reply;

    try {
        const expectedOutputType = getExpectedOutputType(parsedFormat);

        if (expectedOutputType === "object" || expectedOutputType === "array") {
            result = llmResponseJsonParse(reply);

            if (expectedOutputType === "object" && onErrorValidator?.(result)) {
                return failure(formatErrorMessage("Aggregation LLM returned an error response matching onError schema", result));
            }
        }
    } catch (e) {
        console.error("Failed to parse aggregation response:", reply);

        return failure(`Failed to parse aggregation response: ${errorMessage(e)}`);
    }

    /* #if LOGS */
    console.log("Final result:", result);
    /* #endif */

    return {success: true, result};
}

/** 3. Aggregation: every task's result in context, shaped by the node's format when it has one. */
async function aggregate (params: OrchestrationParams, taskResults: AgentTaskResult[]): Promise<OrchestrationResult> {
    /* #if LOGS */
    console.group("[AI Orchestration] Aggregation");
    console.log("Aggregating", taskResults.length, "result(s):", taskResults.map(r => ({task: r.task.content, response: r.response})));
    /* #endif */

    try {
        const format = params.format ?? NO_FORMAT;
        const {parsedFormat} = format;
        // Aggregation has all task results in-context — no tools needed.
        const aggregationResponse = await runSingleCall({
            messages: promptMessages(parsedFormat ? withSchema(params.prompt, parsedFormat) : params.prompt, buildAggregationMessage(taskResults)),
            ...callSettings(params),
            ...(parsedFormat ? {format: parsedFormat} : {}),
        });

        if (!aggregationResponse.success) {
            console.error("Aggregation call failed:", aggregationResponse.error);

            return failure(`Aggregation call failed: ${aggregationResponse.error}`);
        }

        return readAggregation(aggregationResponse.reply, format);
    } finally {
        /* #if LOGS */
        console.groupEnd();
        /* #endif */
    }
}

/**
 * Runs the orchestration pipeline against any input (array, string, object, or a bare
 * primitive) the caller has confirmed is present — see `isOrchestrated` in
 * utils/aiRequest.ts, the only place that decides whether this function gets called:
 *  1. Planning call  — orchestrator (using the node's system prompt) decomposes
 *                      the input into a structured list of agent tasks.
 *  2. Sequential agent calls — one per task, independent, raw text output.
 *  3. Aggregation call — synthesises all task results into the final output,
 *                        applying the node's `format` schema if provided.
 *
 * The task count is entirely planner-decided — an array's length is not a guarantee
 * of the number of tasks produced.
 */
export async function runOrchestration (params: OrchestrationParams): Promise<OrchestrationResult> {
    const tasks = await planTasks(params);

    if (isFailure(tasks)) return tasks;

    const taskResults = await runAgentTasks(params, tasks);

    if (isFailure(taskResults)) return taskResults;

    return aggregate(params, taskResults);
}
