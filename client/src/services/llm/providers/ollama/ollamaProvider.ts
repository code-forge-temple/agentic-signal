/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ChatResponse, Ollama, Tool} from "ollama/browser";
import {savedOllamaHost} from "../../../../context/settingsStorage";
import {LlmProvider, ModelManagement} from "../../llmProvider";
import {ChatReply, ChatRequest, ModelInfo, PullProgress, StreamChatOptions, StreamPart, StreamRequest} from "../../types";

/** Ollama, through ollama-js, straight from the browser: every call goes to the host saved in Settings. */
export class OllamaProvider implements LlmProvider, ModelManagement {
    private ollama: Ollama | null = null;
    private ollamaHost: string | null = null;

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

    chat = async ({messages, model, format, tools, think, temperature, signal}: ChatRequest): Promise<ChatReply> => {
        const ollama = await this.getOllama(signal);

        return ollama.chat({
            model,
            messages,
            format,
            stream: false,
            keep_alive: "60m",
            tools: tools as Tool[] | undefined,
            ...(think !== undefined ? {think} : {}),
            ...(temperature !== undefined ? {options: {temperature}} : {})
        });
    };

    async *streamChat ({messages, model, settings, signal}: StreamRequest): AsyncGenerator<StreamPart, void, unknown> {
        const ollama = await this.getOllama(signal);
        const options = streamOptions(settings);
        const stream = await ollama.chat({
            model,
            messages,
            stream: true,
            keep_alive: "60m",
            // Always explicit: models that think by default (qwen3, deepseek-r1) ignore the
            // setting if `think` is omitted. A level string passes straight through — gpt-oss
            // accepts only levels and discards true/false entirely.
            think: settings?.think ?? false,
            ...(options ? {options} : {})
        });

        for await (const part of stream) yield streamPart(part);
    }

    listModels = async (): Promise<ModelInfo[]> => {
        const ollama = await this.getOllama();
        const {models} = await ollama.list();

        return models;
    };

    /**
     * The model's trained context length, from `ollama.show()`. Only ever used as the upper
     * bound of the context-window slider — it is NOT the window Ollama actually allocates for
     * a request, which Ollama never reports.
     */
    contextLength = async (model: string): Promise<number | null> => {
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

        return typeof contextLength === "number" && contextLength > 0 ? contextLength : null;
    };

    async *pullModel (model: string): AsyncGenerator<PullProgress, void, unknown> {
        const ollama = await this.getOllama();
        const stream = await ollama.pull({model, stream: true});

        for await (const part of stream) yield {completed: part.completed, total: part.total};
    }

    deleteModel = async (model: string): Promise<void> => {
        const ollama = await this.getOllama();

        await ollama.delete({model});
    };
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

/** A streamed Ollama part in the app's terms. Only the terminating part carries the token counts. */
const streamPart = (part: ChatResponse): StreamPart => ({
    content: part.message.content,
    thinking: part.message.thinking,
    promptEvalCount: part.prompt_eval_count,
    evalCount: part.eval_count,
});
