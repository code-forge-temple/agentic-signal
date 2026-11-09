/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Ajv from 'ajv';
import {Message, MessageRole} from '../../../../types/ollama.types';
import {NodeEnvelope} from '../../../../types/workflow';
import {formatErrorMessage} from '../../../../utils/utils';
import {errorMessage} from '@shared/utils';
import {LlmProcessNodeData} from '../types/workflow';
import {JSON_SCHEMA_PROMPT_PREFIX, RunSingleCallParams, runOrchestration, runSingleCall} from './aiOrchestration';
import {assertIsSerializedInput, getExpectedOutputType, llmResponseJsonParse, parseFormat, serializeInput} from './formatUtils';


/** One run of the LLM node: its settings, its input, and the conversation so far. */
export type AIRequest = Pick<LlmProcessNodeData, 'prompt' | 'message' | 'model' | 'format'> & {
    payload?: NodeEnvelope['payload'];
    tools?: RunSingleCallParams['tools'];
    feedback?: string;
    maxToolRetries: number;
    ragHandler?: (input: string) => Promise<string>;
    conversationHistory: {
        value: Message[];
        onChange: (history: Message[]) => void;
    };
    think?: boolean;
    temperature?: number;
    orchestrationMode?: boolean;
};

/** A failure the node reports as it is, unlike an unexpected error. */
export class RequestFailure extends Error {}

// Any input can be split into tasks (an array, a string, an object, even a number). Without input, the node's own
// prompt and message go the normal way: orchestration has no notion of `message`.
const isOrchestrated = (request: AIRequest) => Boolean(request.orchestrationMode) && request.payload != undefined;

/** Why the request can't be sent at all; null when it can. */
export function invalidRequest (request: AIRequest): string | null {
    if (!request.model) return "Please select a model first.";

    if (!isOrchestrated(request) && !request.prompt && !request.message && !request.payload) return "Please provide a prompt, message, or input data.";

    return null;
}

// After a cancel, the next step throws; the caller then sees the aborted signal and ends quietly.
const stopIfCancelled = (signal: AbortSignal) => {
    if (signal.aborted) throw new Error("Cancelled");
};

const message = (role: Message['role'], content: string): Message => ({role, content});

type RequestFormat = {
    schema: object | undefined;
    onErrorValidator: ((data: unknown) => boolean) | undefined;
    /** The node's prompt, followed by the schema when there is one. */
    systemPrompt: string | undefined;
    /**
     * Tools and a schema together: some models don't call tools when asked for structured output, so a first call
     * runs the tools with the plain prompt, and a second one reformats its reply to the schema.
     */
    twoPhase: boolean;
};

const schemaPrompt = (schema: object | undefined) => `${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(schema, null, 4)}`;

function requestFormat (request: AIRequest): RequestFormat {
    let parsed;

    try {
        parsed = parseFormat(request.format);
    } catch (error) {
        throw new RequestFailure(`Invalid format JSON: ${errorMessage(error)}`);
    }

    const schema = parsed.parsedFormat;

    return {
        schema,
        onErrorValidator: parsed.onErrorValidator,
        systemPrompt: schema ? `${request.prompt ? `${request.prompt}\n\n` : ""}${schemaPrompt(schema)}` : request.prompt,
        twoPhase: Boolean(schema && request.tools?.length),
    };
}

// The input as the user message, between the node's prefix and suffix; null with neither input nor message.
function userContent (request: AIRequest): string | null {
    if (request.payload === undefined && !request.message) return null;

    const input = request.payload ? serializeInput(request.payload) : "";

    assertIsSerializedInput(input);

    return request.message ? `${request.message.prefix || ''}${input}${request.message.suffix || ''}` : input;
}

async function withRagContext (content: string, ragHandler: (input: string) => Promise<string>, signal: AbortSignal): Promise<string> {
    try {
        const context = await ragHandler(content);

        stopIfCancelled(signal);

        return context ? `## CONTEXT\n${context}\n\n${content}` : content;
    } catch (error) {
        stopIfCancelled(signal);

        throw new RequestFailure(`RAG retrieval failed: ${errorMessage(error)}`);
    }
}

// eslint-disable-next-line max-len
const feedbackRequest = (feedback: string) => `The previous response caused an error in downstream processing. Here's the feedback: ${feedback}\n\nPlease provide a corrected response that addresses this issue.`;

// A new input without feedback starts the conversation over from its system message.
function restartedConversation (history: Message[], content: string | null): Message[] {
    const system = history.find(entry => entry.role === MessageRole.SYSTEM);

    return [...(system ? [system] : []), ...(content === null ? [] : [message(MessageRole.USER, content)])];
}

const firstMessages = (systemPrompt: string | undefined, content: string | null): Message[] => [
    ...(systemPrompt ? [message(MessageRole.SYSTEM, systemPrompt)] : []),
    ...(content === null ? [] : [message(MessageRole.USER, content)]),
];

/**
 * The messages to send: a first run's system prompt and input (with the RAG context); feedback continues the
 * conversation. Only the RAG context is waited for: without it the messages come at once, so the request goes out in
 * the same tick as the run that sent it (a newer run, or an unmount, then cancels that very request).
 */
function conversation (request: AIRequest, systemPrompt: string | undefined, signal: AbortSignal): Message[] | Promise<Message[]> {
    const history = request.conversationHistory.value;

    if (history.length > 0 && request.feedback) return [...history, message(MessageRole.USER, feedbackRequest(request.feedback))];

    const content = userContent(request);

    if (history.length > 0) return restartedConversation(history, content);

    if (content === null || !request.ragHandler) return firstMessages(systemPrompt, content);

    return withRagContext(content, request.ragHandler, signal).then(withContext => firstMessages(systemPrompt, withContext));
}

const callSettings = (request: AIRequest, signal: AbortSignal) => ({
    model: request.model,
    maxToolRetries: request.maxToolRetries,
    think: request.think,
    temperature: request.temperature,
    signal,
});

async function reply (params: RunSingleCallParams & {signal: AbortSignal}, failure: string): Promise<string> {
    const response = await runSingleCall(params);

    stopIfCancelled(params.signal);

    if (!response.success) throw new RequestFailure(`${failure}: ${response.error}`);

    return response.reply;
}

function matchesSchema (text: string, schema: object): boolean {
    try {
        return Boolean(new Ajv().compile(schema)(llmResponseJsonParse(text)));
    } catch {
        return false;
    }
}

const reformatMessages = (text: string, format: RequestFormat): Message[] => [
    message(MessageRole.SYSTEM, format.systemPrompt ?? schemaPrompt(format.schema)),
    message(MessageRole.USER, `Here is the response to reformat:\n\n${text}\n\nPlease reformat it to strictly match the required JSON schema.`),
];

// The first reply is kept when it already matches the schema.
async function twoPhaseReply (messages: Message[], request: AIRequest, format: RequestFormat, signal: AbortSignal): Promise<string> {
    const first = await reply({...callSettings(request, signal), messages, tools: request.tools}, "Failed to fetch AI response (phase 1)");

    if (format.schema && matchesSchema(first, format.schema)) return first;

    return reply({...callSettings(request, signal), messages: reformatMessages(first, format), format: format.schema}, "Failed to fetch AI response (phase 2)");
}

async function singleReply (messages: Message[], request: AIRequest, format: RequestFormat, signal: AbortSignal): Promise<string> {
    const schema = format.schema ? {format: format.schema} : {};

    return reply({...callSettings(request, signal), messages, ...schema, tools: request.tools}, "Failed to fetch AI response");
}

// The reply as the node's output, parsed when the schema expects an object or an array. A reply matching the onError
// schema fails the request.
function parseResult (text: string, format: RequestFormat): unknown {
    try {
        const expected = getExpectedOutputType(format.schema);

        if (expected !== "object" && expected !== "array") return text;

        const result = llmResponseJsonParse(text);

        if (expected === "object" && format.onErrorValidator?.(result)) {
            throw new RequestFailure(formatErrorMessage("LLM returned an error response matching onError schema", result));
        }

        return result;
    } catch (error) {
        if (error instanceof RequestFailure) throw error;

        throw new RequestFailure(`Failed to parse AI response: ${errorMessage(error)}`);
    }
}

async function orchestrate (request: AIRequest, signal: AbortSignal): Promise<unknown> {
    const result = await runOrchestration({
        input: request.payload,
        prompt: request.prompt,
        model: request.model,
        format: request.format,
        tools: request.tools,
        maxToolRetries: request.maxToolRetries,
        think: request.think,
        temperature: request.temperature,
        signal,
    });

    stopIfCancelled(signal);

    if (!result.success) throw new RequestFailure(result.error);

    return result.result;
}

/**
 * Sends a valid request (see invalidRequest) and resolves with the node's output. Throws a RequestFailure for a failure
 * to report as it is, anything else for an unexpected error; after a cancel it throws too, so check the signal first.
 */
export async function runAIRequest (request: AIRequest, signal: AbortSignal): Promise<unknown> {
    if (isOrchestrated(request)) return orchestrate(request, signal);

    const format = requestFormat(request);
    const built = conversation(request, format.twoPhase ? request.prompt : format.systemPrompt, signal);
    // Not awaited unless it has to be: see conversation.
    const messages = Array.isArray(built) ? built : await built;
    const text = format.twoPhase ? await twoPhaseReply(messages, request, format, signal) : await singleReply(messages, request, format, signal);

    request.conversationHistory.onChange([...messages, message(MessageRole.ASSISTANT, text)]);

    return parseResult(text, format);
}
