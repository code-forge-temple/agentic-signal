/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Ollama} from "ollama/browser";
import {
    ErrorResponse,
    FetchAiResponse,
    FetchModelResponse,
    Message,
    MessageRole,
    SystemUserConfigValues,
    ToolSchema,
    isToolError,
} from "../types/ollama.types";

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
        tools,
        maxToolRetries,
        think,
        temperature
    }: {
        messages: Message[],
        model: string,
        format?: object,
        tools?: {
            schema: ToolSchema,
            systemUserConfigValues: SystemUserConfigValues,
            handler: (params: any) => Promise<any>
        }[],
        maxToolRetries: number,
        think?: boolean,
        temperature?: number
    }): Promise<FetchAiResponse> => {
        try {
            const ollama = await this.getOllama();
            const updatedMessages = messages.map((message) => {
                if (typeof message.content !== "string") {
                    return {
                        ...message,
                        content: JSON.stringify(message.content),
                        images: []
                    };
                } else {
                    const {content, images} = extractImagesAndRemove(message.content);

                    return {
                        ...message,
                        content,
                        images
                    };
                }
            });
            const toolSchemas = tools?.map(t => ({
                type: "function",
                function: t.schema
            }));
            const toolStatus: Record<string, { called: boolean; succeeded: boolean; retryCount: number }> = {};

            if (tools) {
                for (const t of tools) {
                    if(t.systemUserConfigValues.requireToolUse){
                        toolStatus[t.schema.name] = {called: false, succeeded: false, retryCount: 0};
                    }
                }
            }

            const conversationMessages = [...updatedMessages];
            let totalIterations = 0;
            const requiredToolsCount = Object.keys(toolStatus).length;
            const maxConversationRetries = requiredToolsCount > 0
                ? maxToolRetries * requiredToolsCount
                : maxToolRetries;

            /* #if LOGS */
            console.group("[OllamaService] fetchAIResponse");
            console.log("Model:", model);
            console.log("Format:", format ?? "(none)");
            console.log("Tools:", tools?.map(t => t.schema.name) ?? "(none)");
            console.log("Messages:", conversationMessages);
            /* #endif */

            let response = await this.callOllamaChat(ollama, conversationMessages, model, format, toolSchemas, think, temperature);

            /* #if LOGS */
            console.log("Initial response — content:", response.message.content || "(empty)", "| tool_calls:", response.message.tool_calls ?? "(none)");
            /* #endif */

            while (true) {
                if (++totalIterations > maxConversationRetries) break;

                let toolCallsMade = false;

                if (response.message && Array.isArray(response.message.tool_calls) && tools) {
                    for (const toolCall of response.message.tool_calls) {
                        const toolName = toolCall.function.name;
                        const status = toolStatus[toolName];

                        if (status && !status.succeeded && status.retryCount < maxToolRetries) {
                            toolCallsMade = true;

                            const {hasError, toolCallMessage, toolResultMessage} = await this.executeToolCallWithTracking(
                                toolCall,
                                tools,
                                status.retryCount,
                                maxToolRetries
                            );

                            status.called = true;

                            if (!hasError) {
                                status.succeeded = true;
                            } else {
                                status.retryCount++;
                            }

                            conversationMessages.push(toolCallMessage);
                            conversationMessages.push(toolResultMessage);

                            /* #if LOGS */
                            console.log(`Tool "${toolName}" — args:`, toolCall.function.arguments, "| result:", toolResultMessage.content, "| error:", hasError);
                            /* #endif */
                        }
                    }
                }

                const needsRetry = Object.values(toolStatus).some(
                    status => !status.succeeded && status.retryCount < maxToolRetries
                );

                if (!needsRetry) break;

                if (!toolCallsMade) {
                    const unfinishedTools = Object.entries(toolStatus)
                        .filter(([, status]) => !status.succeeded)
                        .map(([name]) => name);

                    if (unfinishedTools.length > 0) {
                        /* #if LOGS */
                        console.log("Nudging LLM to call missing tools:", unfinishedTools);
                        /* #endif */

                        conversationMessages.push({
                            role: MessageRole.USER,
                            content: `You must call the following tools: ${unfinishedTools.join(", ")}. Please make the tool calls now.`,
                            images: []
                        });
                    }
                }

                response = await this.callOllamaChat(ollama, conversationMessages, model, format, toolSchemas, think, temperature);

                /* #if LOGS */
                console.log(`Iteration ${totalIterations} response — content:`, response.message.content || "(empty)", "| tool_calls:", response.message.tool_calls ?? "(none)");
                /* #endif */

                if (response.message.content && response.message.content.trim() !== "") {
                    conversationMessages.push({
                        role: response.message.role as MessageRole,
                        content: response.message.content,
                        images: []
                    });
                }
            }

            if (tools && tools.length > 0) {
                /* #if LOGS */
                console.group("[OllamaService] Final summary call (no tools)");
                console.log("Format:", format ?? "(none)");
                console.log("Messages:", conversationMessages);
                /* #endif */

                response = await this.callOllamaChat(ollama, conversationMessages, model, format, undefined, think, temperature);

                /* #if LOGS */
                console.log("Final summary response:", response.message.content);
                console.groupEnd();
                /* #endif */

                if (response.message.content && response.message.content.trim() !== "") {
                    conversationMessages.push({
                        role: response.message.role as MessageRole,
                        content: response.message.content,
                        images: []
                    });
                }
            }

            if (tools) {
                const notCalled = Object.entries(toolStatus)
                    .filter(([, status]) => !status.called)
                    .map(([name]) => name);
                const notSucceeded = Object.entries(toolStatus)
                    .filter(([, status]) => !status.succeeded)
                    .map(([name]) => name);
                const exceededRetries = Object.entries(toolStatus)
                    .filter(([, status]) => status.retryCount >= maxToolRetries && !status.succeeded)
                    .map(([name]) => name);

                if (notCalled.length > 0 || notSucceeded.length > 0) {
                    return {
                        success: false,
                        error: `Tool calling failed: The following tools were not called successfully: ` +
                            `${[...new Set([...notCalled, ...notSucceeded])].join(", ")}`
                    };
                }

                if (exceededRetries.length > 0) {
                    return {
                        success: false,
                        error: `Tool calling failed after ${maxToolRetries} attempts for: ${exceededRetries.join(", ")}`
                    };
                }
            }

            /* #if LOGS */
            console.log("Returning reply:", response.message.content);
            console.groupEnd();
            /* #endif */

            return {
                success: true,
                final: true,
                reply: response.message.content
            };
        } catch (error) {
            /* #if LOGS */
            console.error("fetchAIResponse error:", error);
            console.groupEnd();
            /* #endif */

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async callOllamaChat (
        ollama: Ollama,
        messages: Message[],
        model: string,
        format?: object,
        tools?: any[],
        think?: boolean,
        temperature?: number
    ) {
        const result = await ollama.chat({
            model,
            messages,
            format,
            stream: false,
            keep_alive: "60m",
            tools,
            ...(think !== undefined ? {think} : {}),
            ...(temperature !== undefined ? {options: {temperature}} : {})
        });

        return result;
    }

    private async executeToolCallWithTracking (
        toolCall: any,
        tools: { schema: ToolSchema, handler: (params: any) => Promise<any> }[],
        currentRetry: number,
        maxRetries: number
    ): Promise<{
    hasError: boolean;
    toolCallMessage: Required<Message>;
    toolResultMessage: Required<Message>;
    toolName: string;
}> {
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;
        const tool = tools.find(t => t.schema.name === toolName);

        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }

        const toolResult = await tool.handler(toolArgs);
        const resultIsToolError = isToolError(toolResult);
        const errorSuffix = resultIsToolError
            ? `\n\nPlease correct the parameters and try again. (Attempt ${currentRetry + 1}/${maxRetries})`
            : "";
        const toolResultContent = resultIsToolError
            ? `Error: ${toolResult.error}${errorSuffix}`
            : (typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult));

        return {
            hasError: resultIsToolError,
            toolCallMessage: {
                role: MessageRole.ASSISTANT,
                content: JSON.stringify(toolCall),
                images: []
            },
            toolResultMessage: {
                role: MessageRole.USER,
                content: toolResultContent,
                images: []
            },
            toolName
        };
    }

    async *streamAIResponse (
        messages: Message[],
        model: string
    ): AsyncGenerator<FetchAiResponse, void, unknown> {
        try {
            const ollama = await this.getOllama();
            const updatedMessages = messages.map((message) => {
                const {content, images} = extractImagesAndRemove(message.content);

                return {...message, content, images};
            });
            const stream = await ollama.chat({model, messages: updatedMessages, stream: true, keep_alive: "60m"});
            let fullReply = "";
            let fullThinking = "";

            for await (const part of stream) {
                if ((part.message as any).thinking) {
                    fullThinking += (part.message as any).thinking;
                }

                fullReply += part.message.content;

                yield {
                    success: true,
                    final: false,
                    reply: fullReply,
                    thinking: fullThinking || undefined
                };
            }

            yield {
                success: true,
                final: true,
                reply: fullReply,
                thinking: fullThinking || undefined
            };
        } catch (error) {
            yield {
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

function extractImagesAndRemove (content: string): { content: string, images: string[] } {
    const imageRegex = /!\[.*?\]\(data:image\/\w+;base64,([^)]+)\)/g;
    const images: string[] = [];
    let match;
    let cleaned = content;

    while ((match = imageRegex.exec(content)) !== null) {
        images.push(match[1]);
    }

    cleaned = cleaned.replace(imageRegex, "");

    return {content: cleaned, images};
}