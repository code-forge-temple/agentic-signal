/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isToolError} from "../../types/tool.types";
import {errorMessage} from "@shared/utils";
import {LlmProvider} from "./llmProvider";
import {recoverToolCallFromContent} from "./leakedToolCalls";
import {toModelMessage} from "./messages";
import {ChatReply, ChatRequest, FetchAiParams, FetchAiResponse, Message, MessageRole, OfferedTool, ToolCall, ToolEntry} from "./types";

type ToolStatus = {called: boolean; succeeded: boolean; retryCount: number};

/** One exchange as it goes: the conversation so far, and how each required tool has fared. */
type Exchange = {
    provider: LlmProvider;
    /** What every request of the exchange sends besides the messages and the tools. */
    chat: Pick<ChatRequest, "model" | "format" | "think" | "temperature">;
    messages: Message[];
    tools?: ToolEntry[];
    toolSchemas?: OfferedTool[];
    /** The tools the model must call (requireToolUse), by name. */
    toolStatus: Record<string, ToolStatus>;
    maxToolRetries: number;
    signal?: AbortSignal;
};

/**
 * The model's answer, after it has called the tools it wanted to and the ones it must (each retried up to
 * `maxToolRetries` times on an error). A required tool that never succeeded fails the call. Works with any provider:
 * only its `chat` is called.
 */
export async function runToolLoop (provider: LlmProvider, params: FetchAiParams): Promise<FetchAiResponse> {
    /* #if LOGS */
    console.groupCollapsed("[LlmService] fetchAIResponse");
    console.log("Model:", params.model);
    console.log("Format:", params.format ?? "(none)");
    console.log("Tools:", params.tools?.map(t => t.schema.name) ?? "(none)");
    /* #endif */

    try {
        const exchange = startExchange(provider, params);

        /* #if LOGS */
        console.log("Messages:", exchange.messages);
        /* #endif */

        const reply = await replyAfterTools(exchange, await converse(exchange));
        // A required tool's failure is the cause to report, even when the summary never came either.
        const toolFailure = toolCallingFailure(exchange.toolStatus, params.maxToolRetries);

        if (toolFailure) {
            return {
                success: false,
                error: toolFailure
            };
        }

        if (!reply) {
            return {
                success: false,
                error: `Model kept emitting tool-call JSON as plain text instead of a final summary after ${params.maxToolRetries} attempt(s).`
            };
        }

        /* #if LOGS */
        console.log("Returning reply:", reply.message.content);
        /* #endif */

        return {
            success: true,
            final: true,
            reply: reply.message.content
        };
    } catch (error) {
        /* #if LOGS */
        console.error("fetchAIResponse error:", error);
        /* #endif */

        return {
            success: false,
            error: errorMessage(error)
        };
    } finally {
        // Every way out closes the group, so the debug log's groups stay balanced.
        /* #if LOGS */
        console.groupEnd();
        /* #endif */
    }
}

/**
 * The exchange at its start: the provider for its requests, the messages as a request carries them (its own list, which
 * the exchange adds to), the required tools.
 */
function startExchange (provider: LlmProvider, {messages, model, format, tools, maxToolRetries, think, temperature, signal}: FetchAiParams): Exchange {
    return {
        provider,
        chat: {model, format, think, temperature},
        messages: messages.map(toModelMessage),
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
async function ask (exchange: Exchange, toolSchemas: Exchange["toolSchemas"]): Promise<ChatReply> {
    const response = await exchange.provider.chat({...exchange.chat, messages: exchange.messages, tools: toolSchemas, signal: exchange.signal});

    recoverToolCallFromContent(response, exchange.tools);

    return response;
}

/**
 * Talks with the model until it asks for no more tool calls and every required tool has been dealt with (it
 * succeeded or used up its retries), or the exchange runs out of rounds. Returns the last response.
 */
async function converse (exchange: Exchange): Promise<ChatReply> {
    const maxRounds = conversationRounds(exchange);
    let response = await ask(exchange, exchange.toolSchemas);
    let rounds = 1;

    /* #if LOGS */
    console.log("Initial response — content:", ...shownResponse(response));
    /* #endif */

    keepTextReply(exchange.messages, response);

    while (true) {
        const toolCallsMade = await runRequestedTools(exchange, response);

        // Stop looping when the LLM returns no tool calls AND all required tools
        // have been addressed (called or exhausted retries). If required tools are
        // still pending, keep looping — the nudge below will prompt the LLM.
        if (!toolCallsMade && !needsRetry(exchange)) break;

        // Budget exhausted — stop asking for another turn. Checked here (after the
        // current `response` has already been fully processed above) rather than at
        // the top of the loop, so a tool call recovered from leaked text on the last
        // fetch always gets executed instead of being silently discarded.
        if (rounds >= maxRounds) break;

        askForMissingTools(exchange, toolCallsMade);

        response = await ask(exchange, exchange.toolSchemas);
        rounds++;

        /* #if LOGS */
        console.log(`Iteration ${rounds} response — content:`, ...shownResponse(response));
        /* #endif */

        keepTextReply(exchange.messages, response);
    }

    return response;
}

/** Runs the tool calls the response asks for; false when none ran. */
async function runRequestedTools (exchange: Exchange, response: ChatReply): Promise<boolean> {
    const {tools} = exchange;

    if (!response.message || !Array.isArray(response.message.tool_calls) || !tools) return false;

    let toolCallsMade = false;

    for (const toolCall of response.message.tool_calls) {
        if (!mayRun(exchange, toolCall)) continue;

        toolCallsMade = true;

        const {hasError, toolResultMessage} = await runToolCall(exchange, tools, toolCall);

        /* #if LOGS */
        console.log(`Tool "${toolCall.function.name}" — args:`, toolCall.function.arguments, "| result:", toolResultMessage.content, "| error:", hasError);
        /* #endif */
    }

    return toolCallsMade;
}

/** Runs one tool call: the call and its result join the conversation, and a required tool's status is updated. */
async function runToolCall (exchange: Exchange, tools: ToolEntry[], toolCall: ToolCall) {
    const status = exchange.toolStatus[toolCall.function.name];

    // A tool can act on the world (fill and submit a form): none starts after a cancel.
    exchange.signal?.throwIfAborted();

    const result = await executeToolCallWithTracking(toolCall, tools, status?.retryCount ?? 0, exchange.maxToolRetries);

    recordToolResult(status, result.hasError);
    exchange.messages.push(result.toolCallMessage, result.toolResultMessage);

    return result;
}

/**
 * The reply to return: `response`, or when the tools left it without text, a final summary asked for with no tools
 * offered. Null when the model never gave that summary.
 */
async function replyAfterTools (exchange: Exchange, response: ChatReply): Promise<ChatReply | null> {
    const {tools} = exchange;

    if (!tools || tools.length === 0 || hasText(response)) return response;

    /* #if LOGS */
    console.groupCollapsed("[LlmService] Final summary call (no tools)");
    console.log("Format:", exchange.chat.format ?? "(none)");
    /* #endif */

    let summary: ChatReply | null;

    try {
        summary = await askForSummary(exchange, tools);
    } finally {
        // Closed even when a tool throws, so the debug log's groups stay balanced.
        /* #if LOGS */
        console.groupEnd();
        /* #endif */
    }

    if (summary) keepTextReply(exchange.messages, summary);

    return summary;
}

/**
 * Even with no tools offered, a destabilized model can keep leaking a tool-call-shaped JSON blob instead of a
 * plain-text summary. That's real actionable data, not prose to discard, so it's recovered and executed (a required
 * tool only while it has retries left, as in the conversation), and the summary asked for again — bounded so a
 * model that keeps leaking can't loop forever. Null when it was still leaking once the attempts ran out: a real
 * error, not leaked JSON returned as if it were a valid answer.
 */
async function askForSummary (exchange: Exchange, tools: ToolEntry[]): Promise<ChatReply | null> {
    const maxAttempts = exchange.maxToolRetries;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        /* #if LOGS */
        console.log(`Attempt ${attempt}/${maxAttempts} — messages:`, exchange.messages);
        /* #endif */

        const response = await ask(exchange, undefined);

        /* #if LOGS */
        console.log(`Attempt ${attempt}/${maxAttempts} response — content:`, ...shownResponse(response));
        /* #endif */

        const toolCalls = response.message.tool_calls;

        if (!Array.isArray(toolCalls) || toolCalls.length === 0) return response;

        // On the last attempt no request is left to report a tool's result, so a leaked call isn't run: its action
        // would happen unreported, behind an error.
        if (attempt === maxAttempts) break;

        for (const toolCall of toolCalls.filter(call => mayRun(exchange, call))) {
            const {hasError, toolResultMessage} = await runToolCall(exchange, tools, toolCall);

            /* #if LOGS */
            console.log(`Recovered call "${toolCall.function.name}" executed — result:`, toolResultMessage.content, "| error:", hasError);
            /* #endif */
        }
    }

    return null;
}

type ToolCallResult = {
    hasError: boolean;
    toolCallMessage: Required<Message>;
    toolResultMessage: Required<Message>;
    toolName: string;
};

async function executeToolCallWithTracking (
    toolCall: ToolCall,
    tools: {schema: ToolEntry["schema"], handler: ToolEntry["handler"]}[],
    currentRetry: number,
    maxRetries: number
): Promise<ToolCallResult> {
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

/** Whether a required tool still has error retries left. */
function hasRetriesLeft (status: ToolStatus, maxToolRetries: number): boolean {
    return status.retryCount < maxToolRetries;
}

/** Whether a required tool has neither succeeded nor used up its retries. */
function isPending (status: ToolStatus, maxToolRetries: number): boolean {
    return !status.succeeded && hasRetriesLeft(status, maxToolRetries);
}

/** Whether a required tool is still pending. */
function needsRetry ({toolStatus, maxToolRetries}: Exchange): boolean {
    return Object.values(toolStatus).some(status => isPending(status, maxToolRetries));
}

/**
 * Whether a tool call may run: not when a required tool has used up its error retries. A succeeded tool may be called
 * again on purpose, so the LLM can perform multi-step workflows with the same tool (e.g. read-form → fill-form).
 */
function mayRun ({toolStatus, maxToolRetries}: Exchange, toolCall: ToolCall): boolean {
    const status = toolStatus[toolCall.function.name];

    return !status || hasRetriesLeft(status, maxToolRetries);
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

/**
 * Nudges the model to call the required tools it hasn't called at all yet. After a turn in which it called no tool, also
 * the ones that failed and may still be retried: it answered instead of trying them again.
 */
function askForMissingTools ({toolStatus, maxToolRetries, messages}: Exchange, toolCallsMade: boolean): void {
    const missing = toolsWhere(toolStatus, status => !status.called || (!toolCallsMade && isPending(status, maxToolRetries)));

    if (missing.length === 0) return;

    /* #if LOGS */
    console.log("Nudging LLM to call missing tools:", missing);
    /* #endif */

    messages.push({
        role: MessageRole.USER,
        content: `You must call the following tools: ${missing.join(", ")}. Please make the tool calls now.`,
        images: []
    });
}

function hasText (response: ChatReply): boolean {
    return !!response.message.content?.trim();
}

/** A response's text joins the conversation. */
function keepTextReply (messages: Message[], response: ChatReply): void {
    if (!hasText(response)) return;

    messages.push({
        role: response.message.role as MessageRole,
        content: response.message.content,
        images: []
    });
}

/** Why the required tools failed: one used up its retries, or one was never called successfully. Null when none did. */
function toolCallingFailure (toolStatus: Record<string, ToolStatus>, maxToolRetries: number): string | null {
    const exceededRetries = toolsWhere(toolStatus, status => !status.succeeded && !hasRetriesLeft(status, maxToolRetries));

    if (exceededRetries.length > 0) return `Tool calling failed after ${maxToolRetries} attempts for: ${exceededRetries.join(", ")}`;

    const failed = new Set([...toolsWhere(toolStatus, status => !status.called), ...toolsWhere(toolStatus, status => !status.succeeded)]);

    if (failed.size > 0) return `Tool calling failed: The following tools were not called successfully: ${[...failed].join(", ")}`;

    return null;
}

/* #if LOGS */
/** A response as the debug log shows it: its text and its tool calls. */
function shownResponse (response: ChatReply): unknown[] {
    return [response.message.content || "(empty)", "| tool_calls:", response.message.tool_calls ?? "(none)"];
}
/* #endif */
