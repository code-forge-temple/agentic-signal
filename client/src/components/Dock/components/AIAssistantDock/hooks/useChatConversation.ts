/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef, useState} from 'react';
import {OllamaService} from '../../../../../services/ollamaService';
import {FetchAiResponseSuccess, Message, MessageRole, StreamAiResponse} from '../../../../../types/ollama.types';
import {ROLE} from '../../../../../constants';
import {useStreamThrottle} from '../../../../../hooks/useStreamThrottle';
import {ChatEntry, ChatMessage, ContextUsage, EMPTY_CONTEXT_USAGE} from '../constants';
import {LlmSettingsMap} from '../utils/llmSettings';
import {streamOptionsFor} from '../utils/modelContext';
import {toModelMessages} from '../utils/chatCommands';
import {contextUsageOf, withReplyReplaced, withReplyText} from '../utils/chatEntries';


/**
 * The chat's entries, with the AI Buddy's reply streaming into them: one reply at a time, which can be stopped on its
 * own (an LLM node running in some layer is left alone). Unmounting stops it.
 */
export function useChatConversation ({model, settingsMap}: {model: string; settingsMap: LlmSettingsMap}) {
    const [messages, setMessages] = useState<ChatEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [contextUsage, setContextUsage] = useState<ContextUsage>(EMPTY_CONTEXT_USAGE);
    const currentStreamRequestId = useRef<symbol | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortControllerRef.current?.abort(), []);

    const {push, flush, cancel} = useStreamThrottle<Pick<FetchAiResponseSuccess, 'reply' | 'thinking'>>({
        delay: 500,
        onFlush: text => setMessages(prev => withReplyText(prev, text)),
    });

    const replaceReply = useCallback((content: string) => setMessages(prev => withReplyReplaced(prev, content)), []);

    // One chunk of the reply: its text goes to the screen (throttled), the last one measures the context used, and an
    // error takes the reply's place. False once the reply ended with an error.
    const takeChunk = useCallback((chunk: StreamAiResponse): boolean => {
        if (!chunk.success) {
            // Drop the buffered partial first: otherwise the flush() after the stream repaints it over the error.
            cancel();

            if (!chunk.error?.toLowerCase().includes('aborted')) replaceReply(`Error: ${chunk.error}`);

            return false;
        }

        push({reply: chunk.reply, thinking: chunk.thinking});

        if (chunk.final) setContextUsage(contextUsageOf(model, chunk));

        return true;
    }, [cancel, push, replaceReply, model]);

    /** Streams the AI Buddy's reply to `conversation` (already on screen) into `reply`, added after it. */
    const streamReply = useCallback(async (conversation: ChatEntry[], systemPrompt: string, reply: ChatMessage = {role: ROLE.ASSISTANT, content: ''}) => {
        const requestId = Symbol('stream-request');
        const controller = new AbortController();
        const isCurrent = () => currentStreamRequestId.current === requestId;

        currentStreamRequestId.current = requestId;
        abortControllerRef.current = controller;
        // Nothing buffered from a previous stream may survive into this one.
        cancel();
        setIsLoading(true);

        const ollamaMessages: Message[] = [{role: MessageRole.SYSTEM, content: systemPrompt}, ...toModelMessages([...conversation, reply])];

        setMessages(prev => [...prev, reply]);

        try {
            for await (const chunk of OllamaService.getInstance().streamAIResponse(ollamaMessages, model, streamOptionsFor(settingsMap, model), controller.signal)) {
                // A newer reply took over.
                if (!isCurrent()) {
                    cancel();

                    break;
                }

                if (!takeChunk(chunk)) break;
            }

            flush();
        } catch {
            // ignore abort
        } finally {
            if (isCurrent()) currentStreamRequestId.current = null;

            if (abortControllerRef.current === controller) abortControllerRef.current = null;

            setIsLoading(false);
        }
    }, [model, settingsMap, cancel, flush, takeChunk]);

    /** Stops the reply in flight. */
    const stopReply = useCallback(() => {
        abortControllerRef.current?.abort();
        currentStreamRequestId.current = null;
    }, []);

    return {messages, setMessages, isLoading, setIsLoading, contextUsage, setContextUsage, streamReply, replaceReply, stopReply, dropBuffered: cancel};
}

export type ChatConversation = ReturnType<typeof useChatConversation>;
