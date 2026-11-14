/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {SystemUserConfigValues, ToolSchema} from "../../types/tool.types";

// The LLM layer's types, in the app's own terms: messages, requests and their answers, the chat's settings. Each
// provider turns them into its server's. What an AI Tool is lives in types/tool.types.ts.

export type ErrorResponse = {
    success: false;
    error: string;
}

export const MessageRole = {
    SYSTEM: "system",
    USER: "user",
    ASSISTANT: "assistant"
} as const;

export type MessageRole = typeof MessageRole[keyof typeof MessageRole];

export type Message = {
    role: MessageRole;
    content: string;
    images?: string[];
};

export type FetchModelResponse =
    | {success: true; reply: number}
    | ErrorResponse;

export type FetchAiResponseSuccess = {
    success: true;
    reply: string;
    thinking?: string;
    final: boolean
}

export type FetchAiResponse =
    | FetchAiResponseSuccess
    | ErrorResponse;

/**
 * Deliberately a separate type from `FetchAiResponseSuccess`, which is shared with
 * `fetchAIResponse` and the whole orchestration path: only the streaming chat reports
 * token counts, so only it should carry them.
 */
export type StreamAiResponseSuccess = FetchAiResponseSuccess & {
    promptEvalCount?: number;
    evalCount?: number;
}

export type StreamAiResponse =
    | StreamAiResponseSuccess
    | ErrorResponse;

/**
 * Ollama's docs also document a "max" level, but the pinned ollama client (0.5.18) types
 * `think` as boolean | "high" | "medium" | "low" and doesn't know about it. Bump that
 * dependency before adding it here rather than casting past its types.
 */
export const THINK_LEVELS = ["low", "medium", "high"] as const;

export type ThinkLevel = typeof THINK_LEVELS[number];

/**
 * Ollama accepts either a boolean or a reasoning level. Most models take both; gpt-oss takes
 * ONLY a level and silently ignores true/false — its trace can be shortened but never disabled.
 */
export type ThinkOption = boolean | ThinkLevel;

export function isThinkLevel (value: unknown): value is ThinkLevel {
    return typeof value === "string" && (THINK_LEVELS as readonly string[]).includes(value);
}

/**
 * Per-request overrides for the streaming chat. Every field is optional and absent means
 * "don't override" — `contextWindow` becomes Ollama's `num_ctx` at the request boundary.
 */
export type StreamChatOptions = {
    think?: ThinkOption;
    temperature?: number;
    contextWindow?: number;
}

export type FetchModelContextLengthResponse =
    | {success: true; contextLength: number | null}
    | ErrorResponse;

/** A tool the model may call during a fetchAIResponse exchange: its schema, its settings, and what runs it. */
export type ToolEntry = {
    schema: ToolSchema,
    systemUserConfigValues: SystemUserConfigValues,
    handler: (params: any) => Promise<any>
};

export type FetchAiParams = {
    messages: Message[],
    model: string,
    format?: object,
    tools?: ToolEntry[],
    maxToolRetries: number,
    think?: boolean,
    temperature?: number,
    /** Cancels the whole exchange: the request in flight, and any tool call not yet started. */
    signal?: AbortSignal
};

/** A tool call the model asked for: the tool's name and the arguments it gave. */
export type ToolCall = {function: {name: string; arguments: unknown}};

/** A tool as a request offers it to the model. */
export type OfferedTool = {type: string; function: ToolSchema};

/** One request to the model, not streamed: the conversation so far and what else to send. */
export type ChatRequest = {
    messages: Message[],
    model: string,
    format?: object,
    tools?: OfferedTool[],
    think?: boolean,
    temperature?: number,
    /** Cancels this request, and nobody else's. */
    signal?: AbortSignal
};

/** The model's reply to a ChatRequest: its text, and the tool calls it asks for. */
export type ChatReply = {message: {role: string; content: string; tool_calls?: ToolCall[]}};

/** One request to the model, streamed (the AI Buddy chat). */
export type StreamRequest = {
    messages: Message[],
    model: string,
    settings?: StreamChatOptions,
    signal?: AbortSignal
};

/** A streamed reply's next part. Only the last part carries the token counts. */
export type StreamPart = {content: string; thinking?: string; promptEvalCount?: number; evalCount?: number};

export type ModelInfo = {name: string};

/** How far a model's download is, in bytes; parts without a total say nothing about it. */
export type PullProgress = {completed?: number; total?: number};

export type FetchModelsResponse = {
    success: true;
    models: ModelInfo[];
} | ErrorResponse;

export type DeleteModelResponse = {
    success: true;
    reply: string;
} | ErrorResponse;
