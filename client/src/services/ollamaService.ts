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
            console.groupCollapsed("[OllamaService] fetchAIResponse");
            console.log("Model:", model);
            console.log("Format:", format ?? "(none)");
            console.log("Tools:", tools?.map(t => t.schema.name) ?? "(none)");
            console.log("Messages:", conversationMessages);
            /* #endif */

            let response = await this.callOllamaChat(ollama, conversationMessages, model, format, toolSchemas, think, temperature);

            this.recoverToolCallFromContent(response, tools);
            totalIterations++;

            /* #if LOGS */
            console.log("Initial response — content:", response.message.content || "(empty)", "| tool_calls:", response.message.tool_calls ?? "(none)");
            /* #endif */

            while (true) {
                let toolCallsMade = false;

                if (response.message && Array.isArray(response.message.tool_calls) && tools) {
                    for (const toolCall of response.message.tool_calls) {
                        const toolName = toolCall.function.name;
                        const status = toolStatus[toolName];

                        // Execute if: not a tracked-required tool, or hasn't exhausted error retries.
                        // Intentionally allows re-calling a succeeded tool so the LLM can perform
                        // multi-step workflows with the same tool (e.g. read-form → fill-form).
                        if (!status || status.retryCount < maxToolRetries) {
                            toolCallsMade = true;

                            const {hasError, toolCallMessage, toolResultMessage} = await this.executeToolCallWithTracking(
                                toolCall,
                                tools,
                                status?.retryCount ?? 0,
                                maxToolRetries
                            );

                            if (status) {
                                status.called = true;

                                if (!hasError) {
                                    status.succeeded = true;
                                } else {
                                    status.retryCount++;
                                }
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

                // Stop looping when the LLM returns no tool calls AND all required tools
                // have been addressed (called or exhausted retries). If required tools are
                // still pending, keep looping — the nudge below will prompt the LLM.
                if (!toolCallsMade && !needsRetry) break;

                // Budget exhausted — stop asking for another turn. Checked here (after the
                // current `response` has already been fully processed above) rather than at
                // the top of the loop, so a tool call recovered from leaked text on the last
                // fetch always gets executed instead of being silently discarded.
                if (totalIterations >= maxConversationRetries) break;

                // Nudge only for required tools the LLM hasn't called at all yet.
                const neverCalledRequired = Object.entries(toolStatus)
                    .filter(([, s]) => !s.called)
                    .map(([name]) => name);

                if (neverCalledRequired.length > 0) {
                    /* #if LOGS */
                    console.log("Nudging LLM to call missing tools:", neverCalledRequired);
                    /* #endif */

                    conversationMessages.push({
                        role: MessageRole.USER,
                        content: `You must call the following tools: ${neverCalledRequired.join(", ")}. Please make the tool calls now.`,
                        images: []
                    });
                }

                response = await this.callOllamaChat(ollama, conversationMessages, model, format, toolSchemas, think, temperature);

                this.recoverToolCallFromContent(response, tools);
                totalIterations++;

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

            const hasTextReply = response.message.content && response.message.content.trim() !== "";

            if (tools && tools.length > 0 && !hasTextReply) {
                /* #if LOGS */
                console.groupCollapsed("[OllamaService] Final summary call (no tools)");
                console.log("Format:", format ?? "(none)");
                /* #endif */

                // Even with no tools offered, a destabilized model can keep leaking a tool-call-shaped
                // JSON blob instead of a plain-text summary. That's real actionable data, not prose to
                // discard, so recover-and-execute it and ask again — bounded so a model that keeps
                // leaking can't loop forever. If it's still leaking once the budget is exhausted,
                // surface a real error instead of returning the leaked JSON as if it were a valid answer.
                const maxFinalSummaryAttempts = maxToolRetries;
                let resolvedCleanly = false;

                for (let attempt = 1; attempt <= maxFinalSummaryAttempts; attempt++) {
                    /* #if LOGS */
                    console.log(`Attempt ${attempt}/${maxFinalSummaryAttempts} — messages:`, conversationMessages);
                    /* #endif */

                    response = await this.callOllamaChat(ollama, conversationMessages, model, format, undefined, think, temperature);

                    this.recoverToolCallFromContent(response, tools);

                    /* #if LOGS */
                    console.log(
                        `Attempt ${attempt}/${maxFinalSummaryAttempts} response — content:`, response.message.content || "(empty)",
                        "| tool_calls:", response.message.tool_calls ?? "(none)"
                    );
                    /* #endif */

                    if (!Array.isArray(response.message.tool_calls) || response.message.tool_calls.length === 0) {
                        resolvedCleanly = true;
                        break;
                    }

                    for (const toolCall of response.message.tool_calls) {
                        const toolName = toolCall.function.name;
                        const status = toolStatus[toolName];

                        const {hasError, toolCallMessage, toolResultMessage} = await this.executeToolCallWithTracking(
                            toolCall, tools, status?.retryCount ?? 0, maxToolRetries
                        );

                        if (status) {
                            status.called = true;

                            if (!hasError) {
                                status.succeeded = true;
                            } else {
                                status.retryCount++;
                            }
                        }

                        conversationMessages.push(toolCallMessage);
                        conversationMessages.push(toolResultMessage);

                        /* #if LOGS */
                        console.log(`Recovered call "${toolName}" executed — result:`, toolResultMessage.content, "| error:", hasError);
                        /* #endif */
                    }
                }

                /* #if LOGS */
                console.groupEnd();
                /* #endif */

                if (!resolvedCleanly) {
                    return {
                        success: false,
                        error: `Model kept emitting tool-call JSON as plain text instead of a final summary after ${maxFinalSummaryAttempts} attempt(s).`
                    };
                }

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

                if (exceededRetries.length > 0) {
                    return {
                        success: false,
                        error: `Tool calling failed after ${maxToolRetries} attempts for: ${exceededRetries.join(", ")}`
                    };
                }

                if (notCalled.length > 0 || notSucceeded.length > 0) {
                    return {
                        success: false,
                        error: `Tool calling failed: The following tools were not called successfully: ` +
                            `${[...new Set([...notCalled, ...notSucceeded])].join(", ")}`
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

    /**
     * Some models occasionally emit a tool call as plain JSON text in `message.content`
     * instead of using Ollama's structured `message.tool_calls` field (observed on later
     * turns of a multi-call tool loop, e.g. gemma models). When that happens the loop in
     * `fetchAIResponse` would otherwise treat the response as a final text answer and never
     * execute the call. This recovers it — but only when the parsed JSON unambiguously names
     * one of the tools actually available in this request, so a normal prose reply (even one
     * that happens to be valid JSON for unrelated reasons) is never affected.
     */
    private recoverToolCallFromContent (
        response: {message: {content?: string; tool_calls?: any[]}},
        tools?: {schema: ToolSchema}[]
    ): void {
        if (!tools || tools.length === 0) return;

        if (Array.isArray(response.message.tool_calls) && response.message.tool_calls.length > 0) return;

        const content = response.message.content?.trim();

        if (!content) return;

        const unfenced = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

        let parsed: unknown;

        try {
            parsed = JSON.parse(unfenced);
        } catch {
            // The model sometimes hallucinates stray tokens around the JSON (e.g. leading
            // garbage before the '{'), which breaks a whole-string parse. Fall back to
            // scanning for the first balanced {...} object anywhere in the text.
            const extracted = this.extractBalancedJsonObject(unfenced);

            if (!extracted) return;

            try {
                parsed = JSON.parse(extracted);
            } catch {
                return;
            }
        }

        const toolNames = new Set(tools.map(t => t.schema.name));
        const candidates = Array.isArray(parsed) ? parsed : [parsed];

        // Models leak tool calls in different shapes: Ollama's own native shape nests
        // { function: { name, arguments } }, but some models (observed with an 8B local
        // model) emit a flatter { name, arguments } instead. Normalize either into the
        // nested shape every downstream consumer (executeToolCallWithTracking) expects.
        const recovered = candidates
            .map((c): {function: {name: string; arguments: unknown}} | null => {
                if (!c || typeof c !== "object") return null;

                const fnSource = "function" in c && (c as any).function && typeof (c as any).function === "object"
                    ? (c as any).function
                    : c;

                if (typeof fnSource.name === "string" && fnSource.arguments !== undefined && toolNames.has(fnSource.name)) {
                    return {function: {name: fnSource.name, arguments: fnSource.arguments}};
                }

                return null;
            })
            .filter((c): c is {function: {name: string; arguments: unknown}} => c !== null);

        if (recovered.length === 0) return;

        /* #if LOGS */
        console.log("Recovered tool call(s) emitted as plain-text content instead of tool_calls:", recovered);
        /* #endif */

        response.message.tool_calls = recovered;
        response.message.content = "";
    }

    /**
     * Scans `text` for the first balanced `{...}` object, respecting string literals
     * (so a `{` or `}` inside a quoted value doesn't throw off the depth count), and
     * returns that substring — or `null` if none closes. Used to recover a tool-call
     * JSON blob from content that has stray tokens hallucinated around it.
     */
    private extractBalancedJsonObject (text: string): string | null {
        const start = text.indexOf("{");

        if (start === -1) return null;

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const char = text[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (char === "\\") {
                    escaped = true;
                } else if (char === '"') {
                    inString = false;
                }

                continue;
            }

            if (char === '"') {
                inString = true;
            } else if (char === "{") {
                depth++;
            } else if (char === "}") {
                depth--;

                if (depth === 0) return text.slice(start, i + 1);
            }
        }

        return null;
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
        // Serialize the whole object (not just `.error`) so tools that attach extra
        // context to an error response (e.g. the current form fields after a blocked
        // submit) don't have that context silently dropped before the LLM sees it.
        const toolResultContent = resultIsToolError
            ? `Error: ${JSON.stringify(toolResult)}${errorSuffix}`
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