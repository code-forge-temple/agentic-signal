/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useAIProcessor} from './useAIProcessor';
import {OllamaService} from '../../../../services/ollamaService';
import {FetchAiResponse} from '../../../../types/ollama.types';

/** Mocks the public `fetchAIResponse` directly. Both the single/two-phase path
 * (via runSingleCall) and orchestration mode (via runOrchestration -> runSingleCall)
 * bottom out here, so this one mock point exercises every mode useAIProcessor supports. */
function mockFetchAIResponse (responses: FetchAiResponse[]) {
    OllamaService.reloadInstance();

    const service = OllamaService.getInstance();
    let callIndex = 0;
    const receivedCalls: any[] = [];

    service.fetchAIResponse = (async (params: any) => {
        receivedCalls.push(params);

        const next = responses[callIndex++];

        if (!next) throw new Error(`Mock ran out of responses at call #${callIndex}`);

        return next;
    }) as any;

    return {receivedCalls, getCallCount: () => callIndex};
}

const success = (reply: string): FetchAiResponse => ({success: true, final: true, reply});
const failure = (error: string): FetchAiResponse => ({success: false, error});

function makeHistory (initial: any[] = []) {
    let value = initial;
    const onChange = vi.fn((newHistory: any[]) => { value = newHistory; });

    return {
        get value () { return value; },
        onChange,
    };
}

describe('useAIProcessor.processAIRequest', () => {
    beforeEach(() => {
        OllamaService.reloadInstance();
    });

    describe('input validation', () => {
        it('fails immediately when no model is provided, without calling OllamaService', async () => {
            const {getCallCount} = mockFetchAIResponse([]);
            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi', prompt: undefined, message: undefined, model: '', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith('Please select a model first.');
            expect(getCallCount()).toBe(0);
        });

        it('fails when there is no prompt, message, or input at all', async () => {
            mockFetchAIResponse([]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: undefined, prompt: undefined, message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith('Please provide a prompt, message, or input data.');
        });
    });

    describe('other exposed behavior', () => {
        it('fetchModels reports an error via onError when OllamaService.fetchModels fails', async () => {
            OllamaService.reloadInstance();

            const service = OllamaService.getInstance();

            service.fetchModels = (async () => ({success: false, error: 'daemon not running'})) as any;

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            let models: string[] = [];

            await act(async () => {
                models = await result.current.fetchModels();
            });

            expect(models).toEqual([]);
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('daemon not running'));
        });

        it('clearError resets the error list back to empty', async () => {
            mockFetchAIResponse([]);

            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: undefined, prompt: undefined, message: undefined, model: '', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(result.current.error).toEqual(['Please select a model first.']);

            act(() => {
                result.current.clearError();
            });

            expect(result.current.error).toEqual([]);
        });

        it('reports an "Unexpected error" via the catch-all when something outside the normal flow throws', async () => {
            mockFetchAIResponse([success('ok')]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));
            const history = makeHistory();

            history.onChange = vi.fn(() => { throw new Error('history store corrupted'); });

            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi', prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: history,
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('Unexpected error: history store corrupted'));
        });
    });

    describe('normal single-call mode', () => {
        it('succeeds with a plain prompt + input, calling OllamaService once', async () => {
            const {receivedCalls, getCallCount} = mockFetchAIResponse([success('Hello back!')]);
            const onSuccess = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onSuccess}));
            const history = makeHistory();

            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi there', prompt: 'You are helpful.', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: history,
                });
            });

            expect(getCallCount()).toBe(1);
            expect(returned).toBe('Hello back!');
            expect(onSuccess).toHaveBeenCalledWith('Hello back!');
            expect(receivedCalls[0].messages).toEqual([
                {role: 'system', content: 'You are helpful.'},
                {role: 'user', content: 'hi there'},
            ]);
            expect(history.onChange).toHaveBeenCalled();
        });

        it('passes tools straight through to the single call', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('done')]);
            const tools = [{schema: {name: 't1', parameters: {} as any}, systemUserConfigValues: {}, handler: async () => ({success: true})}];
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'go', prompt: 'p', message: undefined, model: 'm', format: undefined, tools,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(receivedCalls[0].tools).toBe(tools);
        });

        it('wraps serialized input with message prefix/suffix', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'core', prompt: undefined, message: {prefix: '>>', suffix: '<<'}, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(receivedCalls[0].messages[0]).toEqual({role: 'user', content: '>>core<<'});
        });

        it('reports a clear error when the call fails', async () => {
            mockFetchAIResponse([failure('connection refused')]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi', prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith('Failed to fetch AI response: connection refused');
        });

        it('parses the reply as an object when a format schema expects one', async () => {
            mockFetchAIResponse([success(JSON.stringify({greeting: 'hi'}))]);

            const {result} = renderHook(() => useAIProcessor());
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi', prompt: 'p', message: undefined, model: 'm',
                    format: {onSuccess: JSON.stringify({type: 'object', properties: {greeting: {type: 'string'}}})},
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(returned).toEqual({greeting: 'hi'});
        });

        it('fails when the reply matches the onError schema', async () => {
            mockFetchAIResponse([success(JSON.stringify({error: 'nope'}))]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi', prompt: 'p', message: undefined, model: 'm',
                    format: {
                        onSuccess: JSON.stringify({type: 'object', properties: {greeting: {type: 'string'}}}),
                        onError: JSON.stringify({type: 'object', required: ['error'], properties: {error: {type: 'string'}}}),
                    },
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('onError schema'));
        });

        it('fails with a clear error when the format JSON itself is malformed, without calling OllamaService', async () => {
            const {getCallCount} = mockFetchAIResponse([]);
            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'hi', prompt: 'p', message: undefined, model: 'm', format: {onSuccess: 'not json {{'},
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(getCallCount()).toBe(0);
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('Invalid format JSON'));
        });

        it('fails when the reply cannot be parsed into the object a format schema expects', async () => {
            mockFetchAIResponse([success('][}{')]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'hi', prompt: 'p', message: undefined, model: 'm',
                    format: {onSuccess: JSON.stringify({type: 'object'})},
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to parse AI response'));
        });

        it('calls the RAG handler and prepends its context to the user message', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const ragHandler = vi.fn(async (input: string) => `context for: ${input}`);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'question', prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), ragHandler,
                });
            });

            expect(ragHandler).toHaveBeenCalledWith('question');
            expect(receivedCalls[0].messages[1].content).toBe('## CONTEXT\ncontext for: question\n\nquestion');
        });

        it('leaves the user message untouched when the RAG handler resolves with a falsy context', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const ragHandler = vi.fn(async () => '');
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'question', prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), ragHandler,
                });
            });

            expect(receivedCalls[0].messages[1].content).toBe('question');
        });

        it('uses a plain format-only system prompt when no node-level prompt is configured', async () => {
            const {receivedCalls} = mockFetchAIResponse([success(JSON.stringify({greeting: 'hi'}))]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'hi', prompt: undefined, message: undefined, model: 'm',
                    format: {onSuccess: JSON.stringify({type: 'object', properties: {greeting: {type: 'string'}}})},
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            const systemMessage = receivedCalls[0].messages[0];

            expect(systemMessage.content.startsWith('Your response must be valid JSON')).toBe(true);
        });

        it('sends only a system message for a prompt-only call with no input or message config', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: undefined, prompt: 'You are a helpful assistant.', message: undefined, model: 'm',
                    format: undefined, maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(receivedCalls[0].messages).toEqual([{role: 'system', content: 'You are a helpful assistant.'}]);
        });

        it('uses empty prefix/suffix defaults when message config omits them', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'core', prompt: undefined, message: {}, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(receivedCalls[0].messages[0]).toEqual({role: 'user', content: 'core'});
        });

        it('fails when the RAG handler throws, without calling OllamaService', async () => {
            const {getCallCount} = mockFetchAIResponse([]);
            const ragHandler = vi.fn(async () => { throw new Error('vector store down'); });
            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'question', prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), ragHandler,
                });
            });

            expect(getCallCount()).toBe(0);
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('RAG retrieval failed'));
        });

        it('resets the conversation to just the system message when new input arrives without feedback', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const {result} = renderHook(() => useAIProcessor());
            const history = makeHistory([
                {role: 'system', content: 'sys'},
                {role: 'user', content: 'old question'},
                {role: 'assistant', content: 'old answer'},
            ]);

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'new question', prompt: 'sys', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: history,
                });
            });

            expect(receivedCalls[0].messages).toEqual([
                {role: 'system', content: 'sys'},
                {role: 'user', content: 'new question'},
            ]);
        });

        it('appends the feedback message onto the existing conversation instead of resetting it', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('corrected')]);
            const {result} = renderHook(() => useAIProcessor());
            const history = makeHistory([
                {role: 'system', content: 'sys'},
                {role: 'user', content: 'question'},
                {role: 'assistant', content: 'wrong answer'},
            ]);

            await act(async () => {
                await result.current.processAIRequest({
                    input: undefined, prompt: 'sys', message: undefined, model: 'm', format: undefined,
                    feedback: 'that was wrong', maxToolRetries: 3, conversationHistory: history,
                });
            });

            expect(receivedCalls[0].messages).toHaveLength(4);
            expect(receivedCalls[0].messages[3].content).toContain('that was wrong');
        });

        it('resets to just the system message when continuing a conversation with no feedback and no new input', async () => {
            const {receivedCalls} = mockFetchAIResponse([success('ok')]);
            const {result} = renderHook(() => useAIProcessor());
            const history = makeHistory([
                {role: 'system', content: 'sys'},
                {role: 'user', content: 'old question'},
                {role: 'assistant', content: 'old answer'},
            ]);

            await act(async () => {
                await result.current.processAIRequest({
                    input: undefined, prompt: 'sys', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: history,
                });
            });

            expect(receivedCalls[0].messages).toEqual([{role: 'system', content: 'sys'}]);
        });
    });

    describe('two-phase mode (format + tools together)', () => {
        const tools = [{schema: {name: 't1', parameters: {} as any}, systemUserConfigValues: {}, handler: async () => ({success: true})}];
        const format = {onSuccess: JSON.stringify({type: 'object', properties: {status: {type: 'string'}}})};

        it('short-circuits to phase 1 when it already satisfies the format schema (only one call made)', async () => {
            const {getCallCount} = mockFetchAIResponse([success(JSON.stringify({status: 'ok'}))]);
            const {result} = renderHook(() => useAIProcessor());
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'go', prompt: 'p', message: undefined, model: 'm', format, tools,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(getCallCount()).toBe(1);
            expect(returned).toEqual({status: 'ok'});
        });

        it('runs a phase 2 reformat call when phase 1 does not already match the schema', async () => {
            const {receivedCalls, getCallCount} = mockFetchAIResponse([
                success('the raw tool-calling answer, not JSON'),
                success(JSON.stringify({status: 'reformatted'})),
            ]);
            const {result} = renderHook(() => useAIProcessor());
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: 'go', prompt: 'p', message: undefined, model: 'm', format, tools,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(getCallCount()).toBe(2);
            expect(returned).toEqual({status: 'reformatted'});
            // Phase 1 uses the plain prompt (no schema instructions) so tool-calling isn't hindered.
            expect(receivedCalls[0].messages[0].content).toBe('p');
            // Phase 2 references phase 1's raw reply and asks for a reformat.
            expect(receivedCalls[1].messages[1].content).toContain('the raw tool-calling answer');
            expect(receivedCalls[1].tools).toBeUndefined();
        });

        it('fails when phase 1 fails, without attempting phase 2', async () => {
            const {getCallCount} = mockFetchAIResponse([failure('phase1 down')]);
            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'go', prompt: 'p', message: undefined, model: 'm', format, tools,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(getCallCount()).toBe(1);
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch AI response (phase 1)'));
        });

        it('fails when phase 2 fails', async () => {
            mockFetchAIResponse([success('raw answer'), failure('phase2 down')]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'go', prompt: 'p', message: undefined, model: 'm', format, tools,
                    maxToolRetries: 3, conversationHistory: makeHistory(),
                });
            });

            expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch AI response (phase 2)'));
        });
    });

    describe('orchestration mode', () => {
        it('routes an array input through runOrchestration instead of the normal single-call path', async () => {
            const {getCallCount} = mockFetchAIResponse([
                success(JSON.stringify({tasks: [{content: 'task 1'}]})), // planning
                success('task 1 done'), // agent
                success('Aggregated summary.'), // aggregation
            ]);
            const onSuccess = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onSuccess}));
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: ['url-1'], prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), orchestrationMode: true,
                });
            });

            // 3 calls (planning + 1 agent + aggregation) — proves it went through orchestration,
            // not the 1-call normal path.
            expect(getCallCount()).toBe(3);
            expect(returned).toBe('Aggregated summary.');
            expect(onSuccess).toHaveBeenCalledWith('Aggregated summary.');
        });

        it('routes a string input through orchestration too', async () => {
            const {getCallCount} = mockFetchAIResponse([
                success(JSON.stringify({tasks: [{content: 'task 1'}]})),
                success('task 1 done'),
                success('Aggregated summary.'),
            ]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: 'a long string describing multiple jobs to do', prompt: 'p', message: undefined, model: 'm',
                    format: undefined, maxToolRetries: 3, conversationHistory: makeHistory(), orchestrationMode: true,
                });
            });

            expect(getCallCount()).toBe(3);
        });

        it('falls back to the normal path when orchestrationMode is on but input is neither an array nor a string', async () => {
            const {getCallCount} = mockFetchAIResponse([success('normal reply')]);
            const {result} = renderHook(() => useAIProcessor());
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: {not: 'an array or string'}, prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), orchestrationMode: true,
                });
            });

            // Only 1 call — the normal single-call path, not orchestration's 3-call shape.
            expect(getCallCount()).toBe(1);
            expect(returned).toBe('normal reply');
        });

        it('does not enter orchestration when orchestrationMode is off, even for array input', async () => {
            const {getCallCount, receivedCalls} = mockFetchAIResponse([success('normal reply')]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: ['url-1', 'url-2'], prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), orchestrationMode: false,
                });
            });

            expect(getCallCount()).toBe(1);
            // The array gets serialized as regular JSON input, not decomposed into tasks.
            expect(receivedCalls[0].messages[1].content).toContain('url-1');
        });

        it('reports the orchestration error when planning/agent/aggregation fails', async () => {
            mockFetchAIResponse([failure('planning model unreachable')]);

            const onError = vi.fn();
            const {result} = renderHook(() => useAIProcessor({onError}));
            let returned: any;

            await act(async () => {
                returned = await result.current.processAIRequest({
                    input: ['url-1'], prompt: 'p', message: undefined, model: 'm', format: undefined,
                    maxToolRetries: 3, conversationHistory: makeHistory(), orchestrationMode: true,
                });
            });

            expect(returned).toBeNull();
            expect(onError).toHaveBeenCalledWith(expect.stringContaining('planning model unreachable'));
        });

        it('passes tools through to orchestration for per-task assignment', async () => {
            const tools = [{schema: {name: 'formInteraction', parameters: {} as any}, systemUserConfigValues: {requireToolUse: false}, handler: async () => ({success: true})}];
            const {receivedCalls} = mockFetchAIResponse([
                success(JSON.stringify({tasks: [{content: 'task 1', tools: ['formInteraction']}]})),
                success('task 1 done'),
                success('Done.'),
            ]);
            const {result} = renderHook(() => useAIProcessor());

            await act(async () => {
                await result.current.processAIRequest({
                    input: ['url-1'], prompt: 'p', message: undefined, model: 'm', format: undefined, tools,
                    maxToolRetries: 3, conversationHistory: makeHistory(), orchestrationMode: true,
                });
            });

            // call 1 (index 1) is the agent call — it should have received the resolved tool.
            expect(receivedCalls[1].tools?.[0]?.schema.name).toBe('formInteraction');
        });
    });
});
