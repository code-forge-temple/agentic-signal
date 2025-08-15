/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Ollama} from "ollama/browser";
import {ErrorResponse, FetchAiResponse, FetchModelResponse, Message, ToolSchema} from "../types/ollama.types";


type OllamaModel = {
    name: string;
}

type FetchModelsResponse = {
    success: true;
    models: OllamaModel[];
} | ErrorResponse;

type DeleteModelResponse = {
    success: true;
    reply: string;
} | ErrorResponse;

export class OllamaService {
    private static instance: OllamaService | null = null;
    private ollama: Ollama | null = null;
    private ollamaHost: string | null = null;

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

    private getOllama = async (): Promise<Ollama> => {
        const host = localStorage.getItem("ollamaHost") || "";

        if (!this.ollama || this.ollamaHost !== host) {
            this.ollama = new Ollama({host});
            this.ollamaHost = host;
        }

        return this.ollama;
    };

    fetchModels = async (): Promise<FetchModelsResponse> => {
        try {
            const ollama = await this.getOllama();
            const {models} = await ollama.list();

            return {
                success: true,
                models
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    };

    fetchAIResponse = async ({
        messages,
        model,
        format,
        tools
    }: {
        messages: Message[],
        model: string,
        format?: object,
        tools?: { schema: ToolSchema, handler: (params: any) => Promise<any> }[]
    }): Promise<FetchAiResponse> => {
        try {
            const ollama = await this.getOllama();
            const updatedMessages = messages.map((message) => ({
                ...message,
                content: typeof message.content !== "string" ? JSON.stringify(message.content) : message.content,
                images: extractImages(message.content)
            }));

            const toolSchemas = tools?.map(t => ({
                type: "function",
                function: t.schema
            }));
            let response = await ollama.chat({
                model,
                messages: updatedMessages,
                format,
                stream: false,
                keep_alive: "60m",
                tools: toolSchemas
            });

            if (response.message && Array.isArray(response.message.tool_calls) && tools) {
                for (const toolCall of response.message.tool_calls) {
                    const toolName = toolCall.function.name;
                    const toolArgs = toolCall.function.arguments;
                    const tool = tools.find(t => t.schema.name === toolName);

                    if (!tool) {
                        return {
                            success: false,
                            error: `Tool not found: ${toolName}`
                        };
                    }

                    const toolResult = await tool.handler(toolArgs);
                    const toolResultMessage = {
                        role: "tool",
                        name: toolName,
                        content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult)
                    };

                    response = await ollama.chat({
                        model,
                        messages: [
                            ...updatedMessages,
                            response.message,
                            toolResultMessage
                        ],
                        format,
                        stream: false,
                        keep_alive: "60m",
                        tools: toolSchemas
                    });
                }
            }

            return {
                success: true,
                final: true,
                reply: response.message.content
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async *pullModel (
        model: string
    ): AsyncGenerator<FetchModelResponse, void, unknown> {
        try {
            const ollama = await this.getOllama();
            const stream = await ollama.pull({model, stream: true});
            let lastProgress = -1;

            for await (const part of stream) {
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
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    deleteModel = async (model: string): Promise<DeleteModelResponse> => {
        try {
            const ollama = await this.getOllama();

            await ollama.delete({model});

            return {
                success: true,
                reply: "Model deleted successfully"
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    abortAIResponse = async (): Promise<{ success: true } | ErrorResponse> => {
        try {
            const ollama = await this.getOllama();

            ollama.abort();

            return {
                success: true
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

function extractImages (content: string): string[] {
    const imageRegex = /!\[.*?\]\(data:image\/\w+;base64,([^)]+)\)/g;
    const images: string[] = [];
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
        images.push(match[1]);
    }

    return images;
}