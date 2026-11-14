/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ChatReply, ChatRequest, ModelInfo, PullProgress, StreamPart, StreamRequest} from "./types";

/**
 * What the app needs from an LLM server, in the app's own terms: each provider turns these into its server's API (Ollama:
 * providers/ollama/OllamaProvider.ts). Everything that isn't the server's (the tool-calling loop, building a streamed
 * reply) stays out of it, so a second provider (LM Studio's OpenAI-compatible API, say) brings only its own calls.
 */
export interface LlmProvider {
    /** One request, not streamed. Tool calls come back in the reply: the caller runs them (toolLoop.ts). */
    chat (request: ChatRequest): Promise<ChatReply>;

    /** One request, streamed part by part. */
    streamChat (request: StreamRequest): AsyncIterable<StreamPart>;

    listModels (): Promise<ModelInfo[]>;

    /** The model's trained context length; null when the server doesn't say. */
    contextLength (model: string): Promise<number | null>;
}

/** Downloading and deleting models, for a provider whose server does it (Ollama does). */
export interface ModelManagement {
    pullModel (model: string): AsyncIterable<PullProgress>;

    deleteModel (model: string): Promise<void>;
}
