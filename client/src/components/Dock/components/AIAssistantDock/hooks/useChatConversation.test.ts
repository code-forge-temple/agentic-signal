/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {useChatConversation} from './useChatConversation';
import {OllamaService} from '../../../../../services/ollamaService';
import {Message, MessageRole, StreamAiResponse} from '../../../../../types/ollama.types';
import {ROLE} from '../../../../../constants';
import {ChatEntry, ChatMessage, EMPTY_CONTEXT_USAGE} from '../constants';
import {LlmSettingsMap} from '../utils/llmSettings';


const MODEL = 'a:1';
const NO_SETTINGS: LlmSettingsMap = {};
const ASKED: ChatEntry[] = [{role: ROLE.USER, content: 'hi', sentAt: 1}];

type StreamCall = {messages: Message[]; model: string; signal?: AbortSignal};

/** Ollama streams `chunks` once `gate` opens (at once without one), and each call's request is kept. */
function ollamaStreams (chunks: StreamAiResponse[], gate?: Promise<void>): StreamCall[] {
    const calls: StreamCall[] = [];

    OllamaService.getInstance().streamAIResponse = async function * (messages, model, _settings, signal) {
        calls.push({messages, model, signal});

        await gate;

        yield* chunks;
    };

    return calls;
}

function gated () {
    let open = () => {};
    const gate = new Promise<void>((resolve) => { open = resolve; });

    return {gate, open};
}

const renderConversation = () => renderHook(() => useChatConversation({model: MODEL, settingsMap: NO_SETTINGS}));

type Conversation = ReturnType<typeof renderConversation>['result'];

// As the chat does it: the conversation on screen first, then the reply streamed after it.
function startReply (result: Conversation, reply?: ChatMessage): Promise<void> {
    let streaming: Promise<void> = Promise.resolve();

    act(() => result.current.setMessages(ASKED));
    act(() => { streaming = result.current.streamReply(ASKED, 'system', reply); });

    return streaming;
}

const lastEntry = (result: Conversation) => result.current.messages[result.current.messages.length - 1];

beforeEach(() => {
    OllamaService.reloadInstance();
});

afterEach(() => {
    cleanup();
});

describe('useChatConversation', () => {
    it('streams the reply after the conversation and measures what the finished reply used', async () => {
        const calls = ollamaStreams([
            {success: true, final: false, reply: 'Hel'},
            {success: true, final: true, reply: 'Hello', thinking: 'hmm', promptEvalCount: 100, evalCount: 20},
        ]);
        const {result} = renderConversation();

        await act(() => startReply(result));

        expect(result.current.messages).toEqual([...ASKED, {role: ROLE.ASSISTANT, content: 'Hello', thinking: 'hmm'}]);
        expect(result.current.contextUsage).toEqual({model: MODEL, promptTokens: 100, replyTokens: 20});
        expect(result.current.isLoading).toBe(false);
        expect(calls[0].model).toBe(MODEL);
        expect(calls[0].messages[0]).toEqual({role: MessageRole.SYSTEM, content: 'system'});
        expect(calls[0].messages.some(message => message.content.includes('hi'))).toBe(true);
    });

    it('puts an error in the reply\'s place, keeping the command results it answered from', async () => {
        ollamaStreams([{success: true, final: false, reply: 'partial'}, {success: false, error: 'model crashed'}]);

        const commandResults = {label: 'Results of /research', content: 'found things'};
        const {result} = renderConversation();

        await act(() => startReply(result, {role: ROLE.ASSISTANT, content: '', commandResults}));

        expect(lastEntry(result)).toEqual({role: ROLE.ASSISTANT, content: 'Error: model crashed', commandResults});
        expect(result.current.isLoading).toBe(false);
    });

    it('shows no error for a reply that was stopped', async () => {
        ollamaStreams([{success: false, error: 'The request was aborted.'}]);

        const {result} = renderConversation();

        await act(() => startReply(result));

        expect(lastEntry(result)).toEqual({role: ROLE.ASSISTANT, content: ''});
    });

    it('stops the reply in flight, and nothing it still sends reaches the chat', async () => {
        const {gate, open} = gated();
        const calls = ollamaStreams([{success: true, final: true, reply: 'too late', promptEvalCount: 5, evalCount: 5}], gate);
        const {result} = renderConversation();
        const streaming = startReply(result);

        await act(async () => {});
        expect(result.current.isLoading).toBe(true);

        act(() => result.current.stopReply());
        expect(calls[0].signal?.aborted).toBe(true);

        open();
        await act(() => streaming);

        expect(lastEntry(result)).toEqual({role: ROLE.ASSISTANT, content: ''});
        expect(result.current.contextUsage).toEqual(EMPTY_CONTEXT_USAGE);
        expect(result.current.isLoading).toBe(false);
    });

    it('stops the reply in flight when the chat closes', async () => {
        const {gate, open} = gated();
        const calls = ollamaStreams([], gate);
        const {result, unmount} = renderConversation();
        const streaming = startReply(result);

        await act(async () => {});
        unmount();

        expect(calls[0].signal?.aborted).toBe(true);

        open();
        await streaming;
    });
});
