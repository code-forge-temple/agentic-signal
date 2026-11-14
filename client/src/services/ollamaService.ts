/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {
    FetchAiResponse,
    FetchModelContextLengthResponse,
    FetchModelResponse,
    Message,
    StreamAiResponse,
    StreamChatOptions,
} from "../types/ollama.types";
import {errorMessage} from "@shared/utils";
import {LlmProvider, ModelManagement} from "./llm/LlmProvider";
import {extractImagesAndRemove} from "./llm/messages";
import {OllamaProvider} from "./llm/providers/ollama/OllamaProvider";
import {addStreamedPart, StreamedReply, tokenCounts} from "./llm/streamedReply";
import {runToolLoop} from "./llm/toolLoop";
import {DeleteModelResponse, FetchAiParams, FetchModelsResponse} from "./llm/types";

/**
 * The app's way to the LLM server, for Settings, the AI Buddy chat, the LLM node and the model list. Every call goes
 * through a provider (llm/LlmProvider.ts; Ollama's today) and comes back in the app's own response shapes: a failure is
 * an answer with `success: false`, never thrown.
 */
export class OllamaService {
    private static instance: OllamaService | null = null;
    private provider: LlmProvider & ModelManagement = new OllamaProvider();

    constructor () {
        if (OllamaService.instance) {
            return OllamaService.instance;
        }

        OllamaService.instance = this;
    }

    static getInstance (): OllamaService {
        if (!OllamaService.instance) {
            OllamaService.instance = new OllamaService();
        }

        return OllamaService.instance;
    }

    static reloadInstance (): void {
        OllamaService.instance = null;
        OllamaService.instance = new OllamaService();
    }

    fetchModels = async (): Promise<FetchModelsResponse> => {
        try {
            return {
                success: true,
                models: await this.provider.listModels()
            };
        } catch (error) {
            return {
                success: false,
                error: errorMessage(error)
            };
        }
    };

    /** The model's answer, after the tool calls it made and had to make: llm/toolLoop.ts. */
    fetchAIResponse = (params: FetchAiParams): Promise<FetchAiResponse> => runToolLoop(this.provider, params);

    async *streamAIResponse (
        messages: Message[],
        model: string,
        settings?: StreamChatOptions,
        signal?: AbortSignal
    ): AsyncGenerator<StreamAiResponse, void, unknown> {
        try {
            const updatedMessages = messages.map(message => ({...message, ...extractImagesAndRemove(message.content)}));
            const streamed: StreamedReply = {reply: "", thinking: ""};

            for await (const part of this.provider.streamChat({messages: updatedMessages, model, settings, signal})) {
                addStreamedPart(streamed, part);

                yield {
                    success: true,
                    final: false,
                    reply: streamed.reply,
                    thinking: streamed.thinking || undefined
                };
            }

            yield {
                success: true,
                final: true,
                reply: streamed.reply,
                thinking: streamed.thinking || undefined,
                ...tokenCounts(streamed)
            };
        } catch (error) {
            yield {
                success: false,
                error: errorMessage(error)
            };
        }
    }

    /** The model's trained context length (the context-window slider's upper bound); null when it isn't known. */
    fetchModelContextLength = async (model: string): Promise<FetchModelContextLengthResponse> => {
        try {
            return {
                success: true,
                contextLength: await this.provider.contextLength(model)
            };
        } catch (error) {
            // Deliberately NOT `{success: true, contextLength: null}`: callers cache null
            // permanently, so a transient outage must not poison that cache.
            return {
                success: false,
                error: errorMessage(error)
            };
        }
    };

    async *pullModel (
        model: string
    ): AsyncGenerator<FetchModelResponse, void, unknown> {
        try {
            let lastProgress = -1;

            for await (const part of this.provider.pullModel(model)) {
                if (part.total && part.completed !== undefined) {
                    const progress = Math.floor(100 * (part.completed / part.total));

                    // Only yield if progress increases or is 100
                    if (progress > lastProgress || progress === 100) {
                        yield {
                            success: true,
                            reply: progress
                        };
                        lastProgress = progress;
                    }

                    if (progress === 100) break; // Stop at 100%
                }
            }
        } catch (error) {
            yield {
                success: false,
                error: errorMessage(error)
            };
        }
    }

    deleteModel = async (model: string): Promise<DeleteModelResponse> => {
        try {
            await this.provider.deleteModel(model);

            return {
                success: true,
                reply: "Model deleted successfully"
            };
        } catch (error) {
            return {
                success: false,
                error: errorMessage(error)
            };
        }
    };
}
