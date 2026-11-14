/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OllamaProvider} from './OllamaProvider';
import {MessageRole} from '../../types';


/** The provider's private client handling. Loosely typed on purpose: the tests hand it a bare `{chat}` fake. */
type ProviderInternals = {
    getOllama: (signal?: AbortSignal) => Promise<unknown>;
    ollama: unknown;
};

const internals = (provider: OllamaProvider) => provider as unknown as ProviderInternals;

/** A provider whose client is a fake recording what each chat call got; `signals` what getOllama was asked with. */
function withFakeClient () {
    const provider = new OllamaProvider();
    const received: Record<string, unknown>[] = [];
    const signals: (AbortSignal | undefined)[] = [];
    const client = {
        chat: async (args: Record<string, unknown>) => {
            received.push(args);

            return {message: {role: 'assistant', content: 'hi'}};
        },
    };

    internals(provider).getOllama = async (signal?: AbortSignal) => {
        signals.push(signal);

        return client;
    };

    return {provider, received, signals};
}

const hello = [{role: MessageRole.USER, content: 'hello', images: []}];

describe('OllamaProvider.chat', () => {
    it('builds the request with stream:false and a 60m keep_alive, and returns the client response as-is', async () => {
        const {provider, received} = withFakeClient();

        const result = await provider.chat({messages: hello, model: 'm'});

        expect(received[0]).toMatchObject({
            model: 'm',
            stream: false,
            keep_alive: '60m',
        });
        expect(received[0]).not.toHaveProperty('think');
        expect(received[0]).not.toHaveProperty('options');
        expect(result).toEqual({message: {role: 'assistant', content: 'hi'}});
    });

    it('includes think and options.temperature only when explicitly provided', async () => {
        const {provider, received} = withFakeClient();

        await provider.chat({messages: hello, model: 'm', format: {type: 'object'}, think: true, temperature: 0.7});

        expect(received[0].think).toBe(true);
        expect(received[0].options).toEqual({temperature: 0.7});
        expect(received[0].format).toEqual({type: 'object'});
    });

    it('sends the messages and tools as given, and asks for a client of the request\'s own signal', async () => {
        const {provider, received, signals} = withFakeClient();
        const tools = [{type: 'function', function: {name: 'search', description: '', parameters: {}}}];
        const controller = new AbortController();

        await provider.chat({messages: hello, model: 'm', tools, signal: controller.signal});

        expect(received[0].messages).toBe(hello);
        expect(received[0].tools).toBe(tools);
        expect(received[0]).not.toHaveProperty('signal');
        expect(signals).toEqual([controller.signal]);
    });
});

describe('OllamaProvider per-request cancel (signal)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('gives a request with a signal a client of its own, leaving the shared one alone', async () => {
        const provider = internals(new OllamaProvider());
        const shared = await provider.getOllama();
        const own = await provider.getOllama(new AbortController().signal);

        expect(own).not.toBe(shared);
        expect(await provider.getOllama()).toBe(shared);
    });

    it("cancels that client's requests when the signal aborts, streamed or not", async () => {
        const seen: (AbortSignal | null | undefined)[] = [];

        vi.stubGlobal('fetch', (_input: unknown, init?: RequestInit) => {
            seen.push(init?.signal);

            return new Promise(() => {});
        });

        const controller = new AbortController();
        const client = await internals(new OllamaProvider()).getOllama(controller.signal) as {fetch: typeof fetch};

        // Not streamed: ollama-js passes no signal. Streamed: it passes one of its own.
        void client.fetch('http://x', {});
        void client.fetch('http://x', {signal: new AbortController().signal});

        controller.abort();

        expect(seen).toHaveLength(2);
        expect(seen.every(signal => signal?.aborted)).toBe(true);
    });

    it('still lets ollama-js abort a stream through its own signal', async () => {
        let seen: AbortSignal | null | undefined;

        vi.stubGlobal('fetch', (_input: unknown, init?: RequestInit) => {
            seen = init?.signal;

            return new Promise(() => {});
        });

        const streamController = new AbortController();
        const client = await internals(new OllamaProvider()).getOllama(new AbortController().signal) as {fetch: typeof fetch};

        void client.fetch('http://x', {signal: streamController.signal});
        streamController.abort();

        expect(seen?.aborted).toBe(true);
    });
});

describe('OllamaProvider host handling (getOllama)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('reuses the same client across calls when the configured host has not changed', async () => {
        localStorage.setItem('ollamaHost', 'http://host-a');

        const provider = internals(new OllamaProvider());

        await provider.getOllama();
        const firstClient = provider.ollama;

        await provider.getOllama();
        const secondClient = provider.ollama;

        expect(secondClient).toBe(firstClient);
    });

    it('constructs a new client when the configured host changes', async () => {
        localStorage.setItem('ollamaHost', 'http://host-a');

        const provider = internals(new OllamaProvider());

        await provider.getOllama();
        const firstClient = provider.ollama;

        localStorage.setItem('ollamaHost', 'http://host-b');
        await provider.getOllama();
        const secondClient = provider.ollama;

        expect(secondClient).not.toBe(firstClient);
    });
});
