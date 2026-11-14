/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useChatCommand} from './useChatCommand';
import {useChatConversation} from './useChatConversation';
import {OllamaService} from '../../../../../services/ollamaService';
import {Message, StreamAiResponse} from '../../../../../services/llm/types';
import {NodeEnvelope} from '../../../../../types/workflow';
import {CommandError} from '../../../../../services/commandRouter';
import {CommandWorkflow, withDefaultModel} from '../../../../../workflows';
import {ROLE} from '../../../../../constants';
import {AI_ASSISTANT_TITLE, ChatEntry, ChatMessage} from '../constants';
import {LlmSettingsMap} from '../utils/llmSettings';
import {ModelContextMap} from '../utils/modelContext';
import {commandFailureText, commandReplySystemPrompt, commandResultsLabel, MESSAGE_TIME_NOTE} from '../utils/chatCommands';


const layer = vi.hoisted(() => ({
    run: vi.fn<(command: string, workflow: unknown, input: NodeEnvelope) => Promise<NodeEnvelope>>(),
    stop: vi.fn<() => void>(),
}));

vi.mock('./useAiLayerRun', () => ({useAiLayerRun: () => layer}));

const MODEL = 'a:1';
const NO_SETTINGS: LlmSettingsMap = {};
const NO_CONTEXT: ModelContextMap = {};
const RESEARCH: CommandWorkflow = {
    command: 'research',
    description: 'Looks things up on the web',
    workflow: {nodes: [{id: 'llm', type: 'llm-process', data: {}}], edges: []},
};
const HISTORY: ChatEntry[] = [{role: ROLE.USER, content: 'earlier', sentAt: 1}, {role: ROLE.ASSISTANT, content: 'ok'}];
const STATUS_LINE: ChatMessage = {role: ROLE.ASSISTANT, content: `Running **/research** on the ${AI_ASSISTANT_TITLE} layer…`, runningCommand: 'research'};

function ollamaReplies (reply: string): Message[][] {
    const asked: Message[][] = [];

    OllamaService.getInstance().streamAIResponse = async function * (messages) {
        asked.push(messages);

        yield {success: true, final: true, reply} satisfies StreamAiResponse;
    };

    return asked;
}

function deferred () {
    let resolve: (result: NodeEnvelope) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<NodeEnvelope>((res, rej) => { resolve = res; reject = rej; });

    return {promise, resolve, reject};
}

const renderChat = () => renderHook(() => {
    const conversation = useChatConversation({model: MODEL, settingsMap: NO_SETTINGS});

    return {...conversation, ...useChatCommand({model: MODEL, settingsMap: NO_SETTINGS, contextMap: NO_CONTEXT, conversation})};
});

type Chat = ReturnType<typeof renderChat>['result'];

function startCommand (result: Chat): Promise<void> {
    let running: Promise<void> = Promise.resolve();

    act(() => { running = result.current.runCommand('/research cats', RESEARCH, 'cats', HISTORY); });

    return running;
}

const lastEntry = (result: Chat) => result.current.messages[result.current.messages.length - 1];

beforeEach(() => {
    OllamaService.reloadInstance();
    layer.run.mockReset();
    layer.stop.mockReset();
});

afterEach(() => {
    cleanup();
});

describe('useChatCommand', () => {
    it('shows a status line while the workflow runs on the AI Buddy layer, then answers from its results', async () => {
        const run = deferred();

        layer.run.mockReturnValue(run.promise);

        const asked = ollamaReplies('Cats are great.');
        const {result} = renderChat();
        const running = startCommand(result);

        expect(result.current.messages.slice(0, 2)).toEqual(HISTORY);
        expect(result.current.messages[2]).toMatchObject({role: ROLE.USER, content: '/research cats'});
        expect(lastEntry(result)).toEqual(STATUS_LINE);
        expect(result.current.isLoading).toBe(true);
        expect(layer.run).toHaveBeenCalledWith('research', withDefaultModel(RESEARCH.workflow, MODEL), {payload: 'cats'});

        run.resolve({payload: 'cats purr'});
        await act(() => running);

        const reply = lastEntry(result) as ChatMessage;

        expect(result.current.messages).toHaveLength(4);
        expect(reply.content).toBe('Cats are great.');
        expect(reply.commandResults?.label).toBe(commandResultsLabel('research'));
        expect(reply.commandResults?.content).toContain('cats purr');
        expect(asked[0][0].content).toBe(commandReplySystemPrompt('research', RESEARCH.description, 'cats') + MESSAGE_TIME_NOTE);
        expect(result.current.isLoading).toBe(false);
    });

    it('puts what went wrong in the status line\'s place when the run fails', async () => {
        const error = new CommandError('node_failed', 'The LLM node failed: no model');

        layer.run.mockRejectedValue(error);

        const asked = ollamaReplies('never');
        const {result} = renderChat();

        await act(() => startCommand(result));

        expect(lastEntry(result)).toEqual({role: ROLE.ASSISTANT, content: commandFailureText('research', error)});
        expect(result.current.isLoading).toBe(false);
        expect(asked).toHaveLength(0);
    });

    it('shows no error for a run that was stopped', async () => {
        layer.run.mockRejectedValue(new CommandError('cancelled', 'Stopped.'));

        const {result} = renderChat();

        await act(() => startCommand(result));

        expect(lastEntry(result)).toEqual(STATUS_LINE);
        expect(result.current.isLoading).toBe(false);
    });

    it('stops only a run that is going', async () => {
        const run = deferred();

        layer.run.mockReturnValue(run.promise);

        const {result} = renderChat();

        act(() => result.current.stopCommand());
        expect(layer.stop).not.toHaveBeenCalled();

        const running = startCommand(result);

        act(() => result.current.stopCommand());
        expect(layer.stop).toHaveBeenCalledTimes(1);

        run.reject(new CommandError('cancelled', 'Stopped.'));
        await act(() => running);

        act(() => result.current.stopCommand());
        expect(layer.stop).toHaveBeenCalledTimes(1);
    });
});
