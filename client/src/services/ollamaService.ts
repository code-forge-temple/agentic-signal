/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ChatResponse, Ollama} from "ollama/browser";
import {
    ErrorResponse,
    FetchAiResponse,
    FetchModelContextLengthResponse,
    FetchModelResponse,
    Message,
    MessageRole,
    StreamAiResponse,
    StreamChatOptions,
    SystemUserConfigValues,
    ToolSchema,
    isToolError,
} from "../types/ollama.types";
import {errorMessage} from "@shared/utils";
import {savedOllamaHost} from "../context/settingsStorage";

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

type ToolEntry = {
    schema: ToolSchema,
    systemUserConfigValues: SystemUserConfigValues,
    handler: (params: any) => Promise<any>
};

type FetchAiParams = {
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

/** What a request sends besides its messages. */
type ChatParams = {
    model: string,
    format?: object,
    tools?: any[],
    think?: boolean,
    temperature?: number
};

type ToolStatus = {called: boolean; succeeded: boolean; retryCount: number};

type ToolCall = {function: {name: string; arguments: unknown}};

/** One fetchAIResponse call as it goes: the conversation so far, and how each required tool has fared. */
type Exchange = {
    ollama: Ollama;
    /** What every request of the exchange sends besides the messages and the tools. */
    chat: Omit<ChatParams, "tools">;
    messages: Message[];
    tools?: ToolEntry[];
    toolSchemas?: {type: string; function: ToolSchema}[];
    /** The tools the model must call (requireToolUse), by name. */
    toolStatus: Record<string, ToolStatus>;
    maxToolRetries: number;
    signal?: AbortSignal;
};

type StreamedReply = {reply: string; thinking: string; promptEvalCount?: number; evalCount?: number};

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

    /**
     * The shared client, or with a `signal`, a client of its own for one request: aborting that
     * signal cancels the request (streamed or not) and nobody else's. The shared client's own
     * `abort()` would cancel every stream in flight, in every node and in the chat alike.
     */
    private getOllama = async (signal?: AbortSignal): Promise<Ollama> => {
        const host = savedOllamaHost();

        if (signal) {
            return new Ollama({host, fetch: fetchWithAbortSignal(signal)});
        }

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
                error: errorMessage(error)
            };
        }
    };

    /**
     * The model's answer, after it has called the tools it wanted to and the ones it must (each retried up to
     * `maxToolRetries` times on an error). A required tool that never succeeded fails the call.
     */
    fetchAIResponse = async (params: FetchAiParams): Promise<FetchAiResponse> => {
        try {
            const exchange = await this.startExchange(params);

            /* #if LOGS */
            console.groupCollapsed("[OllamaService] fetchAIResponse");
            console.log("Model:", params.model);
            console.log("Format:", params.format ?? "(none)");
            console.log("Tools:", params.tools?.map(t => t.schema.name) ?? "(none)");
            console.log("Messages:", exchange.messages);
            /* #endif */

            const reply = await this.replyAfterTools(exchange, await this.converse(exchange));

            if (!reply) {
                return {
                    success: false,
                    error: `Model kept emitting tool-call JSON as plain text instead of a final summary after ${params.maxToolRetries} attempt(s).`
                };
            }

            const toolFailure = toolCallingFailure(exchange.toolStatus, params.maxToolRetries);

            if (toolFailure) {
                return {
                    success: false,
                    error: toolFailure
                };
            }

            /* #if LOGS */
            console.log("Returning reply:", reply.message.content);
            console.groupEnd();
            /* #endif */

            return {
                success: true,
                final: true,
                reply: reply.message.content
            };
        } catch (error) {
            /* #if LOGS */
            console.error("fetchAIResponse error:", error);
            console.groupEnd();
            /* #endif */

            return {
                success: false,
                error: errorMessage(error)
            };
        }
    };

    /** The exchange at its start: the client for its requests, the messages as Ollama takes them, the required tools. */
    private async startExchange ({messages, model, format, tools, maxToolRetries, think, temperature, signal}: FetchAiParams): Promise<Exchange> {
        return {
            ollama: await this.getOllama(signal),
            chat: {model, format, think, temperature},
            messages: messages.map(toOllamaMessage),
            tools,
            toolSchemas: tools?.map(t => ({
                type: "function",
                function: t.schema
            })),
            toolStatus: requiredToolStatus(tools),
            maxToolRetries,
            signal,
        };
    }

    /** One request with the conversation so far. A tool call the model leaked into its text is recovered. */
    private async ask (exchange: Exchange, toolSchemas: Exchange["toolSchemas"]): Promise<ChatResponse> {
        const response = await this.callOllamaChat(exchange.ollama, exchange.messages, {...exchange.chat, tools: toolSchemas});

        this.recoverToolCallFromContent(response, exchange.tools);

        return response;
    }

    /**
     * Talks with the model until it asks for no more tool calls and every required tool has been dealt with (it
     * succeeded or used up its retries), or the exchange runs out of rounds. Returns the last response.
     */
    private async converse (exchange: Exchange): Promise<ChatResponse> {
        const maxRounds = conversationRounds(exchange);
        let response = await this.ask(exchange, exchange.toolSchemas);
        let rounds = 1;

        /* #if LOGS */
        console.log("Initial response — content:", ...shownResponse(response));
        /* #endif */

        while (true) {
            const toolCallsMade = await this.runRequestedTools(exchange, response);

            // Stop looping when the LLM returns no tool calls AND all required tools
            // have been addressed (called or exhausted retries). If required tools are
            // still pending, keep looping — the nudge below will prompt the LLM.
            if (!toolCallsMade && !needsRetry(exchange)) break;

            // Budget exhausted — stop asking for another turn. Checked here (after the
            // current `response` has already been fully processed above) rather than at
            // the top of the loop, so a tool call recovered from leaked text on the last
            // fetch always gets executed instead of being silently discarded.
            if (rounds >= maxRounds) break;

            askForMissingTools(exchange);

            response = await this.ask(exchange, exchange.toolSchemas);
            rounds++;

            /* #if LOGS */
            console.log(`Iteration ${rounds} response — content:`, ...shownResponse(response));
            /* #endif */

            keepTextReply(exchange.messages, response);
        }

        return response;
    }

    /** Runs the tool calls the response asks for; false when none ran. */
    private async runRequestedTools (exchange: Exchange, response: ChatResponse): Promise<boolean> {
        const {tools, toolStatus, maxToolRetries} = exchange;

        if (!response.message || !Array.isArray(response.message.tool_calls) || !tools) return false;

        let toolCallsMade = false;

        for (const toolCall of response.message.tool_calls) {
            const status = toolStatus[toolCall.function.name];

            // Skipped only when a required tool has used up its error retries. A succeeded tool
            // may be called again on purpose, so the LLM can perform multi-step workflows with the
            // same tool (e.g. read-form → fill-form).
            if (status && status.retryCount >= maxToolRetries) continue;

            toolCallsMade = true;

            const {hasError, toolResultMessage} = await this.runToolCall(exchange, tools, toolCall);

            /* #if LOGS */
            console.log(`Tool "${toolCall.function.name}" — args:`, toolCall.function.arguments, "| result:", toolResultMessage.content, "| error:", hasError);
            /* #endif */
        }

        return toolCallsMade;
    }

    /** Runs one tool call: the call and its result join the conversation, and a required tool's status is updated. */
    private async runToolCall (exchange: Exchange, tools: ToolEntry[], toolCall: ToolCall) {
        const status = exchange.toolStatus[toolCall.function.name];

        // A tool can act on the world (fill and submit a form): none starts after a cancel.
        exchange.signal?.throwIfAborted();

        const result = await this.executeToolCallWithTracking(toolCall, tools, status?.retryCount ?? 0, exchange.maxToolRetries);

        recordToolResult(status, result.hasError);
        exchange.messages.push(result.toolCallMessage, result.toolResultMessage);

        return result;
    }

    /**
     * The reply to return: `response`, or when the tools left it without text, a final summary asked for with no tools
     * offered. Null when the model never gave that summary.
     */
    private async replyAfterTools (exchange: Exchange, response: ChatResponse): Promise<ChatResponse | null> {
        const {tools} = exchange;

        if (!tools || tools.length === 0 || hasText(response)) return response;

        /* #if LOGS */
        console.groupCollapsed("[OllamaService] Final summary call (no tools)");
        console.log("Format:", exchange.chat.format ?? "(none)");
        /* #endif */

        const summary = await this.askForSummary(exchange, tools);

        /* #if LOGS */
        console.groupEnd();
        /* #endif */

        if (summary) keepTextReply(exchange.messages, summary);

        return summary;
    }

    /**
     * Even with no tools offered, a destabilized model can keep leaking a tool-call-shaped JSON blob instead of a
     * plain-text summary. That's real actionable data, not prose to discard, so it's recovered and executed, and the
     * summary asked for again — bounded so a model that keeps leaking can't loop forever. Null when it was still
     * leaking once the attempts ran out: a real error, not leaked JSON returned as if it were a valid answer.
     */
    private async askForSummary (exchange: Exchange, tools: ToolEntry[]): Promise<ChatResponse | null> {
        const maxAttempts = exchange.maxToolRetries;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            /* #if LOGS */
            console.log(`Attempt ${attempt}/${maxAttempts} — messages:`, exchange.messages);
            /* #endif */

            const response = await this.ask(exchange, undefined);

            /* #if LOGS */
            console.log(`Attempt ${attempt}/${maxAttempts} response — content:`, ...shownResponse(response));
            /* #endif */

            const toolCalls = response.message.tool_calls;

            if (!Array.isArray(toolCalls) || toolCalls.length === 0) return response;

            for (const toolCall of toolCalls) {
                const {hasError, toolResultMessage} = await this.runToolCall(exchange, tools, toolCall);

                /* #if LOGS */
                console.log(`Recovered call "${toolCall.function.name}" executed — result:`, toolResultMessage.content, "| error:", hasError);
                /* #endif */
            }
        }

        return null;
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

        const recovered = leakedToolCalls(parseLeakedJson(content), new Set(tools.map(t => t.schema.name)));

        if (recovered.length === 0) return;

        /* #if LOGS */
        console.log("Recovered tool call(s) emitted as plain-text content instead of tool_calls:", recovered);
        /* #endif */

        response.message.tool_calls = recovered;
        response.message.content = "";
    }

    private async callOllamaChat (ollama: Ollama, messages: Message[], {model, format, tools, think, temperature}: ChatParams): Promise<ChatResponse> {
        return ollama.chat({
            model,
            messages,
            format,
            stream: false,
            keep_alive: "60m",
            tools,
            ...(think !== undefined ? {think} : {}),
            ...(temperature !== undefined ? {options: {temperature}} : {})
        });
    }

    private async executeToolCallWithTracking (
        toolCall: { function: { name: string; arguments: unknown } },
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
            // A made-up name, or (in orchestration) a tool another task was given: the model is told
            // what it can call and carries on, within the conversation's round limit.
            const available = tools.map(t => t.schema.name).join(", ") || "none";

            return {
                hasError: true,
                toolCallMessage: {role: MessageRole.ASSISTANT, content: JSON.stringify(toolCall), images: []},
                toolResultMessage: {
                    role: MessageRole.USER,
                    content: `Error: there is no tool named "${toolName}" here. The tools you can call are: ${available}.`,
                    images: []
                },
                toolName
            };
        }

        const toolResult: unknown = await tool.handler(toolArgs);
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
        model: string,
        settings?: StreamChatOptions,
        signal?: AbortSignal
    ): AsyncGenerator<StreamAiResponse, void, unknown> {
        try {
            const ollama = await this.getOllama(signal);
            const updatedMessages = messages.map((message) => {
                const {content, images} = extractImagesAndRemove(message.content);

                return {...message, content, images};
            });
            const options = streamOptions(settings);
            const stream = await ollama.chat({
                model,
                messages: updatedMessages,
                stream: true,
                keep_alive: "60m",
                // Always explicit: models that think by default (qwen3, deepseek-r1) ignore the
                // setting if `think` is omitted. A level string passes straight through — gpt-oss
                // accepts only levels and discards true/false entirely.
                think: settings?.think ?? false,
                ...(options ? {options} : {})
            });
            const streamed: StreamedReply = {reply: "", thinking: ""};

            for await (const part of stream) {
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

    /**
     * The model's trained context length, from `ollama.show()`. Only ever used as the upper
     * bound of the context-window slider — it is NOT the window Ollama actually allocates for
     * a request, which Ollama never reports.
     */
    fetchModelContextLength = async (model: string): Promise<FetchModelContextLengthResponse> => {
        try {
            const ollama = await this.getOllama();
            const {model_info: modelInfo} = await ollama.show({model});
            // `model_info` is typed as a Map but arrives as a plain object (it comes straight
            // from `response.json()`), so it has to be indexed rather than `.get()`.
            const info = (modelInfo ?? {}) as unknown as Record<string, unknown>;
            const architecture = info["general.architecture"];
            // The key is namespaced by architecture, e.g. "llama.context_length". Fall back to
            // scanning for the suffix when the model doesn't declare its architecture.
            const key = typeof architecture === "string" && `${architecture}.context_length` in info
                ? `${architecture}.context_length`
                : Object.keys(info).find((infoKey) => infoKey.endsWith(".context_length"));
            const contextLength = key ? info[key] : undefined;

            return {
                success: true,
                contextLength: typeof contextLength === "number" && contextLength > 0 ? contextLength : null
            };
        } catch (error) {
            // Deliberately NOT `{success: true, contextLength: null}`: callers cache null
            // permanently, so a transient outage must not poison that cache.
            return {
                success: false,
                error: errorMessage(error)
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
                error: errorMessage(error)
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
                error: errorMessage(error)
            };
        }
    }
}

/**
 * A fetch for a one-request client: `signal` cancels it. ollama-js passes a signal of its own for
 * streams (its iterator's `abort()`); that one keeps working too.
 */
function fetchWithAbortSignal (signal: AbortSignal): typeof fetch {
    return (input, init) => {
        const ownSignal = init?.signal;

        if (!ownSignal) return fetch(input, {...init, signal});

        // Both, by hand: AbortSignal.any() is missing from older WebKit (the Tauri webview on Linux and macOS).
        const controller = new AbortController();
        const abort = () => controller.abort();

        for (const source of [signal, ownSignal]) {
            if (source.aborted) {
                controller.abort();
            } else {
                source.addEventListener("abort", abort, {once: true});
            }
        }

        return fetch(input, {...init, signal: controller.signal});
    };
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

/** A message as Ollama takes it: text content, with the images inlined in it moved to `images`. */
function toOllamaMessage (message: Message): Message {
    if (typeof message.content !== "string") {
        return {
            ...message,
            content: JSON.stringify(message.content),
            images: []
        };
    }

    const {content, images} = extractImagesAndRemove(message.content);

    return {
        ...message,
        content,
        images
    };
}

/** The tools the model must call (requireToolUse), none called yet. */
function requiredToolStatus (tools: ToolEntry[] = []): Record<string, ToolStatus> {
    return Object.fromEntries(tools
        .filter(tool => tool.systemUserConfigValues.requireToolUse)
        .map(tool => [tool.schema.name, {called: false, succeeded: false, retryCount: 0}]));
}

/** The names of the required tools whose status `matches`. */
function toolsWhere (toolStatus: Record<string, ToolStatus>, matches: (status: ToolStatus) => boolean): string[] {
    return Object.entries(toolStatus)
        .filter(([, status]) => matches(status))
        .map(([name]) => name);
}

/** How many requests an exchange may make: each required tool gets its own retries' worth. */
function conversationRounds ({toolStatus, maxToolRetries}: Exchange): number {
    const requiredToolsCount = Object.keys(toolStatus).length;

    return requiredToolsCount > 0 ? maxToolRetries * requiredToolsCount : maxToolRetries;
}

/** Whether a required tool has neither succeeded nor used up its retries. */
function needsRetry ({toolStatus, maxToolRetries}: Exchange): boolean {
    return Object.values(toolStatus).some(status => !status.succeeded && status.retryCount < maxToolRetries);
}

/** Records a call of a required tool; a tool the model may leave alone has no status. */
function recordToolResult (status: ToolStatus | undefined, hasError: boolean): void {
    if (!status) return;

    status.called = true;

    if (hasError) {
        status.retryCount++;
    } else {
        status.succeeded = true;
    }
}

/** Nudges the model to call the required tools it hasn't called at all yet. */
function askForMissingTools ({toolStatus, messages}: Exchange): void {
    const neverCalledRequired = toolsWhere(toolStatus, status => !status.called);

    if (neverCalledRequired.length === 0) return;

    /* #if LOGS */
    console.log("Nudging LLM to call missing tools:", neverCalledRequired);
    /* #endif */

    messages.push({
        role: MessageRole.USER,
        content: `You must call the following tools: ${neverCalledRequired.join(", ")}. Please make the tool calls now.`,
        images: []
    });
}

function hasText (response: ChatResponse): boolean {
    return !!response.message.content?.trim();
}

/** A response's text joins the conversation. */
function keepTextReply (messages: Message[], response: ChatResponse): void {
    if (!hasText(response)) return;

    messages.push({
        role: response.message.role as MessageRole,
        content: response.message.content,
        images: []
    });
}

/** Why the required tools failed: one used up its retries, or one was never called successfully. Null when none did. */
function toolCallingFailure (toolStatus: Record<string, ToolStatus>, maxToolRetries: number): string | null {
    const exceededRetries = toolsWhere(toolStatus, status => status.retryCount >= maxToolRetries && !status.succeeded);

    if (exceededRetries.length > 0) return `Tool calling failed after ${maxToolRetries} attempts for: ${exceededRetries.join(", ")}`;

    const failed = new Set([...toolsWhere(toolStatus, status => !status.called), ...toolsWhere(toolStatus, status => !status.succeeded)]);

    if (failed.size > 0) return `Tool calling failed: The following tools were not called successfully: ${[...failed].join(", ")}`;

    return null;
}

/** The JSON in a response's text, code fence or not; undefined when there is none. */
function parseLeakedJson (content: string): unknown {
    const unfenced = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
        return JSON.parse(unfenced);
    } catch {
        // The model sometimes hallucinates stray tokens around the JSON (e.g. leading
        // garbage before the '{'), which breaks a whole-string parse. Fall back to
        // scanning for the first balanced {...} object anywhere in the text.
        const extracted = extractBalancedJsonObject(unfenced);

        if (!extracted) return undefined;

        try {
            return JSON.parse(extracted);
        } catch {
            return undefined;
        }
    }
}

/**
 * The tool calls in leaked JSON (one call or a list) that name one of `toolNames`. Models leak tool calls in different
 * shapes: Ollama's own native shape nests { function: { name, arguments } }, but some models (observed with an 8B local
 * model) emit a flatter { name, arguments } instead. Either becomes the nested shape every downstream consumer
 * (executeToolCallWithTracking) expects.
 */
function leakedToolCalls (parsed: unknown, toolNames: Set<string>): ToolCall[] {
    const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

    return candidates
        .map(candidate => asToolCall(candidate, toolNames))
        .filter((call): call is ToolCall => call !== null);
}

function asToolCall (candidate: unknown, toolNames: Set<string>): ToolCall | null {
    if (!candidate || typeof candidate !== "object") return null;

    const nested = (candidate as { function?: unknown }).function;
    const fnSource = (nested && typeof nested === "object" ? nested : candidate) as { name?: unknown; arguments?: unknown };
    const {name, arguments: args} = fnSource;

    if (typeof name !== "string" || !toolNames.has(name) || args === undefined) return null;

    return {function: {name, arguments: args}};
}

/**
 * Scans `text` for the first balanced `{...}` object, respecting string literals
 * (so a `{` or `}` inside a quoted value doesn't throw off the depth count), and
 * returns that substring — or `null` if none closes. Used to recover a tool-call
 * JSON blob from content that has stray tokens hallucinated around it.
 */
function extractBalancedJsonObject (text: string): string | null {
    const start = text.indexOf("{");

    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            ({inString, escaped} = insideString(char, escaped));

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

/** One character inside a string literal: whether the string goes on after it, and whether it escapes the next. */
function insideString (char: string, escaped: boolean): {inString: boolean; escaped: boolean} {
    if (escaped) return {inString: true, escaped: false};

    return {inString: char !== '"', escaped: char === "\\"};
}

/**
 * Ollama's `options` for a streamed reply; none when nothing is set. Built as one object rather than two conditional
 * `{options: ...}` spreads, which would overwrite each other key-for-key. This is also the only place our
 * `contextWindow` becomes Ollama's `num_ctx`.
 */
function streamOptions (settings?: StreamChatOptions): Record<string, number> | undefined {
    const options: Record<string, number> = {};

    if (settings?.temperature !== undefined) {
        options.temperature = settings.temperature;
    }

    if (settings?.contextWindow !== undefined) {
        options.num_ctx = settings.contextWindow;
    }

    return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Adds a streamed part to the reply so far. Only the terminating `done: true` part carries the token counts, and the
 * stream's loop consumes it, so they're latched here for the final chunk.
 */
function addStreamedPart (streamed: StreamedReply, part: ChatResponse): void {
    if (part.message.thinking) {
        streamed.thinking += part.message.thinking;
    }

    streamed.reply += part.message.content;

    if (typeof part.prompt_eval_count === "number") {
        streamed.promptEvalCount = part.prompt_eval_count;
    }

    if (typeof part.eval_count === "number") {
        streamed.evalCount = part.eval_count;
    }
}

/** The token counts Ollama reported, leaving out any it didn't. */
function tokenCounts ({promptEvalCount, evalCount}: StreamedReply) {
    return {
        ...(promptEvalCount !== undefined ? {promptEvalCount} : {}),
        ...(evalCount !== undefined ? {evalCount} : {})
    };
}

/* #if LOGS */
/** A response as the debug log shows it: its text and its tool calls. */
function shownResponse (response: ChatResponse): unknown[] {
    return [response.message.content || "(empty)", "| tool_calls:", response.message.tool_calls ?? "(none)"];
}
/* #endif */
