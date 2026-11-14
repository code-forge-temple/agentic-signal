/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ErrorResponse, Message, StreamChatOptions, SystemUserConfigValues, ToolSchema} from "../../types/ollama.types";

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
