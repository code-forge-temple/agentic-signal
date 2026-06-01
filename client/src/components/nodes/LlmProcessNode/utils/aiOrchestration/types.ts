/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Message, SystemUserConfigValues, ToolSchema} from "../../../../../types/ollama.types";

export type AgentTask = {
    /** The content/request the individual agent should process. */
    content: string;
    /** Optional per-task system prompt override decided by the orchestrator. */
    systemPrompt?: string;
    /** Tool names (exact) the orchestrator decided this task needs.
     *  Only tools in this list are passed to the agent call.
     *  The original requireToolUse flag on each tool is preserved. */
    tools?: string[];
    /** Zero-based indices of earlier tasks whose output this task depends on.
     *  Only backward references (index < this task's index) are valid.
     *  The referenced tasks' outputs are injected as context into this agent's prompt. */
    dependsOn?: number[];
};

export type OrchestratorPlan = {
    tasks: AgentTask[];
};

export type AgentTaskResult = {
    task: AgentTask;
    response: string;
};

export type RunSingleCallParams = {
    messages: Message[];
    model: string;
    format?: object;
    tools?: {
        schema: ToolSchema;
        systemUserConfigValues: SystemUserConfigValues;
        handler: (params: any) => Promise<any>;
    }[];
    maxToolRetries: number;
    think?: boolean;
    temperature?: number;
};

export type OrchestrationParams = {
    /** Accepts any value; orchestration mode is only entered when the caller
     *  confirms it is an array. Typed as `any` so future string-planning support
     *  requires no signature changes. */
    input: any;
    prompt?: string;
    model: string;
    format?: { onSuccess?: string; onError?: string; };
    tools?: {
        schema: ToolSchema;
        systemUserConfigValues: SystemUserConfigValues;
        handler: (params: any) => Promise<any>;
    }[];
    maxToolRetries: number;
    think?: boolean;
    temperature?: number;
};

export type OrchestrationResult =
    | { success: true; result: any }
    | { success: false; error: string };
