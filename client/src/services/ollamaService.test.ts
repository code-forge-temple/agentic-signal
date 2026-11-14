/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OllamaService} from './ollamaService';
import {MessageRole, StreamAiResponse} from '../types/ollama.types';
import {ChatRequest} from './llm/types';

type CannedResponse = {message: {role: string; content?: string; tool_calls?: any[]}};

/** The service's provider (Ollama's), whose `chat` and client the tests replace. Loosely typed on purpose. */
type ProviderInternals = {
    chat: (request: ChatRequest) => Promise<unknown>;
    getOllama: (signal?: AbortSignal) => Promise<unknown>;
};

const providerOf = (service: OllamaService) => (service as unknown as {provider: ProviderInternals}).provider;

/** Mocks only the provider's `chat` — everything else (the loop, recovery, retries, tool
 * execution) runs for real, against the actual implementation. */
function mockService (mockResponses: CannedResponse[]) {
    OllamaService.reloadInstance();

    const service = OllamaService.getInstance();
    let callIndex = 0;
    const receivedRequests: ChatRequest[] = [];
    // The conversation is one array that keeps growing; this keeps what each request saw.
    const sentMessages: {role: string; content: string}[][] = [];

    providerOf(service).chat = async (request: ChatRequest) => {
        receivedRequests.push(request);
        sentMessages.push([...request.messages]);

        const next = mockResponses[callIndex++];

        if (!next) throw new Error(`Mock ran out of responses at call #${callIndex}`);

        return next;
    };

    return {service, getCallCount: () => callIndex, receivedRequests, sentMessages};
}

/** Mocks the provider's `getOllama` to return a fake client — for the methods that talk to Ollama
 * directly (list/pull/delete/streaming chat/show). */
function mockOllamaClient (overrides: Partial<Record<'list' | 'chat' | 'pull' | 'delete' | 'abort' | 'show', any>>) {
    OllamaService.reloadInstance();

    const service = OllamaService.getInstance();
    const client = {list: undefined, chat: undefined, pull: undefined, delete: undefined, abort: undefined, show: undefined, ...overrides};

    providerOf(service).getOllama = async () => client;

    return {service, client};
}

async function* fakeAsyncStream<T> (chunks: T[]): AsyncGenerator<T> {
    for (const chunk of chunks) yield chunk;
}

function makeTools (handlerLog: any[], requireToolUse = true, handlerResult: any = {success: true}) {
    return [{
        schema: {name: 'formInteraction', description: '', parameters: {}},
        systemUserConfigValues: {requireToolUse},
        handler: async (params: any) => {
            handlerLog.push(params);

            return handlerResult;
        },
    }];
}

const nativeToolCall = (args: object = {url: 'http://x'}, name = 'formInteraction') => ({
    function: {name, arguments: args},
});

const leakedNested = (args: object = {url: 'http://x'}, name = 'formInteraction') =>
    JSON.stringify({function: {name, arguments: args}});

const leakedFlat = (args: object = {url: 'http://x'}, name = 'formInteraction') =>
    JSON.stringify({name, arguments: args});

describe('OllamaService.fetchAIResponse', () => {
    beforeEach(() => {
        OllamaService.reloadInstance();
    });

    it('succeeds with a clean reply when the model uses native tool_calls throughout', async () => {
        const handlerLog: any[] = [];
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'All done, form submitted successfully.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 5,
        });

        expect(handlerLog).toHaveLength(1);
        expect(result).toEqual({success: true, final: true, reply: 'All done, form submitted successfully.'});
    });

    it('succeeds with no tools at all (plain conversational call)', async () => {
        const {service} = mockService([
            {message: {role: 'assistant', content: 'Hi there!'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'hello', images: []}],
            model: 'm',
            maxToolRetries: 3,
        });

        expect(result).toEqual({success: true, final: true, reply: 'Hi there!'});
    });

    it('treats an empty tools array the same as no tools (no crash, no final-summary phase)', async () => {
        const {service} = mockService([
            {message: {role: 'assistant', content: 'ok, nothing to call here.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'hello', images: []}],
            model: 'm',
            tools: [],
            maxToolRetries: 3,
        });

        expect(result).toEqual({success: true, final: true, reply: 'ok, nothing to call here.'});
    });

    it('fails when a required tool is never called at all', async () => {
        // maxToolRetries: 1 -> maxConversationRetries: 1, so the loop's own cap is hit
        // after a single (prose, no tool_calls) response — no need to script a nudge round.
        const handlerLog: any[] = [];
        const {service} = mockService([
            {message: {role: 'assistant', content: 'Sure, here you go.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 1,
        });

        expect(handlerLog).toHaveLength(0);
        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/not called successfully/);
    });

    it('stops calling a tool once its retry budget is exhausted and fails cleanly', async () => {
        const handlerLog: any[] = [];
        const maxToolRetries = 2;
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}}, // attempt 1: fails, retryCount -> 1
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}}, // attempt 2: fails, retryCount -> 2 (== budget)
            {message: {role: 'assistant', content: 'I am unable to proceed further.'}}, // gives up — budget exhausted, this 3rd call is never executed
        ]);

        const tools = makeTools(handlerLog, true, {error: 'always fails'});

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools,
            maxToolRetries,
        });

        // Called exactly twice — the retry-budget gate skips executing it a third time.
        expect(handlerLog).toHaveLength(2);
        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/failed after 2 attempts for: formInteraction/);
    });

    it('allows re-calling a tool that already succeeded (multi-step workflows, e.g. read-then-write)', async () => {
        const handlerLog: any[] = [];
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({step: 1})]}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({step: 2})]}},
            {message: {role: 'assistant', content: 'Both steps complete.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 5,
        });

        expect(handlerLog).toEqual([{step: 1}, {step: 2}]);
        expect(result).toEqual({success: true, final: true, reply: 'Both steps complete.'});
    });

    it('tells the model which tools it has when it calls one it was not given, and carries on', async () => {
        const handlerLog: any[] = [];
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'someUnknownTool')]}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Form filled.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 3,
        });

        expect(handlerLog).toHaveLength(1);
        expect(result).toEqual({success: true, final: true, reply: 'Form filled.'});

        // The second request answers the made-up call, followed by the usual nudge for the required tool.
        const contents = (receivedRequests[1].messages as {content: string}[]).map(m => m.content);
        const answer = contents.indexOf('Error: there is no tool named "someUnknownTool" here. The tools you can call are: formInteraction.');

        expect(answer).toBeGreaterThan(-1);
        expect(contents[answer + 1]).toBe('You must call the following tools: formInteraction. Please make the tool calls now.');
    });

    it('stops at the round limit when the model keeps calling a tool it was not given, running nothing', async () => {
        const handlerLog: any[] = [];
        const unknownCall = {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'someUnknownTool')]}};
        const {service, getCallCount} = mockService([
            unknownCall, unknownCall, unknownCall,
            // The final-summary step offers no tools; a model that still calls one is asked again.
            unknownCall,
            {message: {role: 'assistant', content: 'I cannot do that.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 3,
        });

        expect(handlerLog).toHaveLength(0);
        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/not called successfully: formInteraction/);
        // 3 rounds (the limit for one required tool with 3 retries), then 2 final-summary attempts.
        expect(getCallCount()).toBe(5);
    });

    it('passes a string tool result through as-is, without JSON-stringifying it', async () => {
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Reported back.'}},
        ]);

        const tools = [{
            schema: {name: 'formInteraction', description: '', parameters: {}},
            systemUserConfigValues: {requireToolUse: true},
            handler: async () => 'a plain string result',
        }];

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 3,
        });

        // The 2nd request's messages should carry the raw string,
        // not a JSON-stringified version of it.
        const secondCallMessages = receivedRequests[1].messages;
        const toolResultMessage = secondCallMessages.find(m => m.content === 'a plain string result');

        expect(toolResultMessage).toBeDefined();
    });

    it('preserves extra context fields (not just .error) in the message sent back to the model on tool error', async () => {
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Understood.'}},
        ]);

        const tools = [{
            schema: {name: 'formInteraction', description: '', parameters: {}},
            systemUserConfigValues: {requireToolUse: true},
            handler: async () => ({error: 'Submit blocked', formFields: [{name: 'email', required: true}]}),
        }];

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 1,
        });

        const secondCallMessages = receivedRequests[1].messages;
        const toolResultMessage = secondCallMessages.find(m => m.content?.includes('Submit blocked'));

        expect(toolResultMessage?.content).toContain('formFields');
        expect(toolResultMessage?.content).toContain('email');
    });

    it('nudges only for required tools not yet called when there are several', async () => {
        const handlerLog: {tool: string}[] = [];
        const {service, receivedRequests} = mockService([
            // Neither required tool called on the first turn.
            {message: {role: 'assistant', content: 'thinking...'}},
            // Second turn: both get called.
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'toolA'), nativeToolCall({}, 'toolB')]}},
            {message: {role: 'assistant', content: 'Both tools used.'}},
        ]);

        const tools = [
            {
                schema: {name: 'toolA', description: '', parameters: {}},
                systemUserConfigValues: {requireToolUse: true},
                handler: async () => {
                    handlerLog.push({tool: 'toolA'});

                    return {success: true};
                },
            },
            {
                schema: {name: 'toolB', description: '', parameters: {}},
                systemUserConfigValues: {requireToolUse: true},
                handler: async () => {
                    handlerLog.push({tool: 'toolB'});

                    return {success: true};
                },
            },
        ];

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 5,
        });

        expect(handlerLog).toEqual([{tool: 'toolA'}, {tool: 'toolB'}]);
        expect(result).toEqual({success: true, final: true, reply: 'Both tools used.'});

        // The nudge pushed before the 2nd request should mention both tool names.
        const secondCallMessages = receivedRequests[1].messages;
        const nudge = secondCallMessages.find(m => m.content?.includes('must call'));

        expect(nudge?.content).toContain('toolA');
        expect(nudge?.content).toContain('toolB');
    });

    it('JSON-stringifies non-string message content before sending it to Ollama', async () => {
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: 'ok'}},
        ]);

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: {nested: 'object'} as unknown as string, images: []}],
            model: 'm',
            maxToolRetries: 3,
        });

        const firstCallMessages = receivedRequests[0].messages;

        expect(firstCallMessages[0].content).toBe(JSON.stringify({nested: 'object'}));
    });

    it('extracts base64 images out of markdown-image syntax in message content', async () => {
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: 'ok'}},
        ]);

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'Look: ![pic](data:image/png;base64,ABCD1234)', images: []}],
            model: 'm',
            maxToolRetries: 3,
        });

        const firstCallMessages = receivedRequests[0].messages;

        expect(firstCallMessages[0].content).not.toContain('data:image');
        expect(firstCallMessages[0].images).toEqual(['ABCD1234']);
    });

    it('leaves the caller\'s messages as they were, keeping the tool calls and nudges in a list of its own', async () => {
        const {service} = mockService([
            {message: {role: 'assistant', content: 'thinking'}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'done'}},
        ]);
        const messages = [{role: MessageRole.USER, content: 'Look: ![pic](data:image/png;base64,ABCD1234)', images: []}];
        const before = structuredClone(messages);

        expect(await service.fetchAIResponse({messages, model: 'm', tools: makeTools([]), maxToolRetries: 3}))
            .toEqual({success: true, final: true, reply: 'done'});
        expect(messages).toEqual(before);
    });

    it('passes format/think/temperature through to every chat request', async () => {
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: 'ok'}},
        ]);

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            format: {type: 'object'},
            think: true,
            temperature: 0.3,
            maxToolRetries: 3,
        });

        const {model, format, think, temperature} = receivedRequests[0];

        expect(model).toBe('m');
        expect(format).toEqual({type: 'object'});
        expect(think).toBe(true);
        expect(temperature).toBe(0.3);
    });

    it('stops running a required tool once it has used up its retries, even while the rounds last', async () => {
        const failingCalls: unknown[] = [];
        const tools = [
            {
                schema: {name: 'failing', description: '', parameters: {}},
                systemUserConfigValues: {requireToolUse: true},
                handler: async (params: unknown) => {
                    failingCalls.push(params);

                    return {error: 'bad input'};
                },
            },
            {
                schema: {name: 'working', description: '', parameters: {}},
                systemUserConfigValues: {requireToolUse: true},
                handler: async () => ({success: true}),
            },
        ];
        // Two required tools give two rounds per retry; the model asks for the failing tool again in the second.
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'failing')]}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'failing'), nativeToolCall({}, 'working')]}},
            {message: {role: 'assistant', content: 'done'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 1,
        });

        expect(failingCalls).toHaveLength(1);
        expect(result).toEqual({success: false, error: 'Tool calling failed after 1 attempts for: failing'});
    });

    it('keeps the text of each reply in the conversation for the next request', async () => {
        const {service, receivedRequests} = mockService([
            {message: {role: 'assistant', content: 'Hello'}},
            {message: {role: 'assistant', content: 'I will call it'}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Done'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools: makeTools([]),
            maxToolRetries: 3,
        });

        // The conversation is one array, so the last request's shows everything that joined it.
        const conversation = receivedRequests[3].messages as {role: string; content: string}[];

        expect(conversation).toContainEqual({role: 'assistant', content: 'Hello', images: []});
        expect(conversation).toContainEqual({role: 'assistant', content: 'I will call it', images: []});
        expect(result).toEqual({success: true, final: true, reply: 'Done'});
    });

    it('keeps the text of the first reply before the tool calls it came with', async () => {
        const {service, sentMessages} = mockService([
            {message: {role: 'assistant', content: 'Let me check the form', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Done'}},
        ]);

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools: makeTools([]),
            maxToolRetries: 3,
        });

        expect(sentMessages[1].map(message => message.content).slice(0, 3)).toEqual(['go', 'Let me check the form', JSON.stringify(nativeToolCall())]);
    });

    it('asks again for a required tool that failed when the model answers instead of retrying it', async () => {
        const results = [{error: 'bad url'}, {success: true}];
        const tools = [{
            schema: {name: 'formInteraction', description: '', parameters: {}},
            systemUserConfigValues: {requireToolUse: true},
            handler: async () => results.shift(),
        }];
        const {service, sentMessages} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'I cannot open that page.'}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({url: 'http://y'})]}},
            {message: {role: 'assistant', content: 'Done'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 3,
        });

        const nudge = 'You must call the following tools: formInteraction. Please make the tool calls now.';
        const nudges = (messages: {content: string}[]) => messages.filter(message => message.content === nudge).length;

        // Not after the failed call itself (its error result already asks for a retry): after the answer that skipped it.
        expect(nudges(sentMessages[1])).toBe(0);
        expect(sentMessages[2].slice(-2).map(message => message.content)).toEqual(['I cannot open that page.', nudge]);
        expect(nudges(sentMessages[2])).toBe(1);
        expect(result).toEqual({success: true, final: true, reply: 'Done'});
    });

    it('does not run, in the final summary, a required tool that has used up its retries', async () => {
        const handlerLog: unknown[] = [];
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: leakedNested()}},
            {message: {role: 'assistant', content: 'Sorry, the form keeps failing.'}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools: makeTools(handlerLog, true, {error: 'blocked'}),
            maxToolRetries: 2,
        });

        expect(handlerLog).toHaveLength(2);
        expect(result).toEqual({success: false, error: 'Tool calling failed after 2 attempts for: formInteraction'});
    });

    it('reports the failed required tool, not the missing summary, when both happen', async () => {
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: leakedNested()}},
            {message: {role: 'assistant', content: leakedNested()}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools: makeTools([], true, {error: 'blocked'}),
            maxToolRetries: 2,
        });

        expect(result).toEqual({success: false, error: 'Tool calling failed after 2 attempts for: formInteraction'});
    });

    it('does not run a tool call leaked on the last summary attempt, whose result nothing would report', async () => {
        const handlerLog: unknown[] = [];
        const {service, getCallCount} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: leakedNested()}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'go', images: []}],
            model: 'm',
            tools: makeTools(handlerLog, false),
            maxToolRetries: 1,
        });

        expect(handlerLog).toHaveLength(1);
        expect(getCallCount()).toBe(2);
        expect(result).toEqual({success: false, error: 'Model kept emitting tool-call JSON as plain text instead of a final summary after 1 attempt(s).'});
    });

    describe('debug log groups', () => {
        const groupBalance = async (responses: CannedResponse[], tools: ReturnType<typeof makeTools>, maxToolRetries: number) => {
            const opened = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
            const closed = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

            vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});

            try {
                const {service} = mockService(responses);
                const result = await service.fetchAIResponse({messages: [{role: MessageRole.USER, content: 'go', images: []}], model: 'm', tools, maxToolRetries});

                return {opened: opened.mock.calls.length, closed: closed.mock.calls.length, success: (result as {success: boolean}).success};
            } finally {
                vi.restoreAllMocks();
            }
        };

        it('closes its group, and only its own, when Ollama can\'t even be set up', async () => {
            const opened = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
            const closed = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

            vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});

            try {
                OllamaService.reloadInstance();

                const service = OllamaService.getInstance();

                // The provider's real chat, whose client can't be made.
                providerOf(service).getOllama = async () => { throw new Error('bad host'); };

                expect(await service.fetchAIResponse({messages: [], model: 'm', maxToolRetries: 1})).toEqual({success: false, error: 'bad host'});
                expect([opened.mock.calls.length, closed.mock.calls.length]).toEqual([1, 1]);
            } finally {
                vi.restoreAllMocks();
            }
        });

        it('closes every group it opens when a required tool fails', async () => {
            const balance = await groupBalance([{message: {role: 'assistant', content: 'no tools for me'}}], makeTools([]), 1);

            expect(balance).toEqual({opened: 1, closed: 1, success: false});
        });

        it('closes every group it opens when the summary never comes', async () => {
            const balance = await groupBalance([
                {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
                {message: {role: 'assistant', content: leakedNested()}},
            ], makeTools([], false), 1);

            expect(balance).toEqual({opened: 2, closed: 2, success: false});
        });

        it('closes every group it opens when a tool throws during the summary', async () => {
            let calls = 0;
            const tools = makeTools([]);

            tools[0].handler = async () => {
                calls++;

                if (calls > 1) throw new Error('tool crashed');

                return {success: true};
            };

            // The tool succeeds, an empty reply ends the conversation, and the summary leaks a call to it.
            const balance = await groupBalance([
                {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
                {message: {role: 'assistant', content: ''}},
                {message: {role: 'assistant', content: leakedNested()}},
                {message: {role: 'assistant', content: 'unreached'}},
            ], tools, 2);

            expect(balance).toEqual({opened: 2, closed: 2, success: false});
        });
    });

    describe('leaked tool-call recovery (regression coverage)', () => {
        it('executes a call recovered right before the iteration cap instead of dropping it', async () => {
            // Previously: the cap was checked before processing an already-fetched response,
            // so a call recovered on the last allowed fetch was silently discarded.
            const handlerLog: any[] = [];
            const {service} = mockService([
                {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}}, // discover
                {message: {role: 'assistant', content: 'All pages complete, form submitted.'}}, // clean summary
            ]);

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'fill', images: []}],
                model: 'm',
                tools: makeTools(handlerLog),
                maxToolRetries: 1, // maxConversationRetries = 1 with a single required tool
            });

            expect(handlerLog).toHaveLength(1);
            expect(result).toEqual({success: true, final: true, reply: 'All pages complete, form submitted.'});
        });

        it('recovers a single leaked call during the final-summary phase and still resolves cleanly', async () => {
            const handlerLog: any[] = [];
            const {service} = mockService([
                {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}}, // discover
                {message: {role: 'assistant', content: leakedNested({page: 2})}}, // leaks once
                {message: {role: 'assistant', content: 'Done, submitted successfully.'}}, // then resolves
            ]);

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'fill', images: []}],
                model: 'm',
                tools: makeTools(handlerLog),
                maxToolRetries: 3,
            });

            expect(handlerLog).toHaveLength(2);
            expect(result).toEqual({success: true, final: true, reply: 'Done, submitted successfully.'});
        });

        it('tracks a retry when a call recovered during final-summary errors, and still succeeds on the next attempt', async () => {
            const handlerResults = [{success: true}, {error: 'transient'}];
            const handlerLog: any[] = [];
            const tools = [{
                schema: {name: 'formInteraction', description: '', parameters: {}},
                systemUserConfigValues: {requireToolUse: true},
                handler: async (params: any) => {
                    handlerLog.push(params);

                    return handlerResults.shift();
                },
            }];
            const {service} = mockService([
                {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}}, // discover: succeeds
                {message: {role: 'assistant', content: ''}}, // no tool_calls, no content -> loop ends naturally
                {message: {role: 'assistant', content: leakedNested({page: 2})}}, // final-summary attempt 1: leaks, errors
                {message: {role: 'assistant', content: 'Done, recovered from a transient error.'}}, // attempt 2: clean
            ]);

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'fill', images: []}],
                model: 'm',
                tools,
                maxToolRetries: 2,
            });

            expect(handlerLog).toHaveLength(2);
            // Already succeeded once (on discover), so a later transient error during
            // final-summary recovery doesn't undo that — the overall call still succeeds.
            expect(result).toEqual({success: true, final: true, reply: 'Done, recovered from a transient error.'});
        });

        it('returns a real error instead of raw leaked JSON when the model never stops leaking', async () => {
            const handlerLog: any[] = [];
            const maxToolRetries = 2;
            const {service} = mockService([
                {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}}, // discover
                {message: {role: 'assistant', content: leakedNested({page: 2})}},
                {message: {role: 'assistant', content: leakedNested({page: 2})}},
                {message: {role: 'assistant', content: leakedNested({page: 2})}},
                {message: {role: 'assistant', content: leakedNested({page: 2})}},
                {message: {role: 'assistant', content: leakedNested({page: 2})}},
            ]);

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'fill', images: []}],
                model: 'm',
                tools: makeTools(handlerLog),
                maxToolRetries,
            });

            expect(result.success).toBe(false);
            expect((result as any).error).toMatch(/kept emitting tool-call JSON/);
            // Never returns the raw leaked JSON dressed up as a successful reply.
            expect(JSON.stringify(result)).not.toContain('"function"');
        });

        it('recovers a flat { name, arguments } leaked shape, not just the nested one', async () => {
            const handlerLog: any[] = [];
            const {service} = mockService([
                {message: {role: 'assistant', content: leakedFlat()}},
                {message: {role: 'assistant', content: 'Submitted.'}},
            ]);

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'fill', images: []}],
                model: 'm',
                tools: makeTools(handlerLog),
                maxToolRetries: 3,
            });

            expect(handlerLog).toHaveLength(1);
            expect(result).toEqual({success: true, final: true, reply: 'Submitted.'});
        });

        it('recovers every valid call from an array of multiple leaked calls in one response', async () => {
            const handlerLog: {tool: string}[] = [];
            const leakedArray = JSON.stringify([
                {function: {name: 'toolA', arguments: {}}},
                {function: {name: 'toolB', arguments: {}}},
            ]);
            const {service} = mockService([
                {message: {role: 'assistant', content: leakedArray}},
                {message: {role: 'assistant', content: 'Both done.'}},
            ]);

            const tools = [
                {
                    schema: {name: 'toolA', description: '', parameters: {}},
                    systemUserConfigValues: {requireToolUse: true},
                    handler: async () => {
                        handlerLog.push({tool: 'toolA'});

                        return {success: true};
                    },
                },
                {
                    schema: {name: 'toolB', description: '', parameters: {}},
                    systemUserConfigValues: {requireToolUse: true},
                    handler: async () => {
                        handlerLog.push({tool: 'toolB'});

                        return {success: true};
                    },
                },
            ];

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'go', images: []}],
                model: 'm',
                tools,
                maxToolRetries: 5,
            });

            expect(handlerLog).toEqual([{tool: 'toolA'}, {tool: 'toolB'}]);
            expect(result).toEqual({success: true, final: true, reply: 'Both done.'});
        });

        it('filters out invalid entries from a mixed array of leaked calls, recovering only the valid ones', async () => {
            const handlerLog: any[] = [];
            const mixedArray = JSON.stringify([
                {function: {name: 'formInteraction', arguments: {url: 'http://x'}}},
                {not: 'a tool call at all'},
                {function: {name: 'someOtherUnregisteredTool', arguments: {}}},
            ]);
            const {service} = mockService([
                {message: {role: 'assistant', content: mixedArray}},
                {message: {role: 'assistant', content: 'Done.'}},
            ]);

            const result = await service.fetchAIResponse({
                messages: [{role: MessageRole.USER, content: 'go', images: []}],
                model: 'm',
                tools: makeTools(handlerLog),
                maxToolRetries: 3,
            });

            expect(handlerLog).toHaveLength(1);
            expect(result).toEqual({success: true, final: true, reply: 'Done.'});
        });
    });
});

describe('OllamaService.fetchModels', () => {
    it('returns the model list on success', async () => {
        const {service} = mockOllamaClient({
            list: async () => ({models: [{name: 'llama3'}, {name: 'gemma'}]}),
        });

        const result = await service.fetchModels();

        expect(result).toEqual({success: true, models: [{name: 'llama3'}, {name: 'gemma'}]});
    });

    it('returns an error response when listing fails', async () => {
        const {service} = mockOllamaClient({
            list: async () => { throw new Error('connection refused'); },
        });

        const result = await service.fetchModels();

        expect(result).toEqual({success: false, error: 'connection refused'});
    });
});

describe('OllamaService.deleteModel', () => {
    it('reports success after deleting', async () => {
        let receivedArgs: Record<string, unknown> = {};
        const {service} = mockOllamaClient({
            delete: async (args: Record<string, unknown>) => { receivedArgs = args; },
        });

        const result = await service.deleteModel('llama3');

        expect(result).toEqual({success: true, reply: 'Model deleted successfully'});
        expect(receivedArgs).toEqual({model: 'llama3'});
    });

    it('returns an error response when deletion fails', async () => {
        const {service} = mockOllamaClient({
            delete: async () => { throw new Error('model in use'); },
        });

        const result = await service.deleteModel('llama3');

        expect(result).toEqual({success: false, error: 'model in use'});
    });
});

describe('OllamaService cancel (signal)', () => {
    beforeEach(() => {
        localStorage.clear();
        OllamaService.reloadInstance();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('starts no tool call once fetchAIResponse is cancelled', async () => {
        const handlerLog: any[] = [];
        const controller = new AbortController();
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
        ]);
        const provider = providerOf(service);
        const cannedCall = provider.chat;

        // Cancelled while the model answers with a tool call.
        provider.chat = async (request: ChatRequest) => {
            controller.abort();

            return cannedCall(request);
        };

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 5,
            signal: controller.signal,
        });

        expect(handlerLog).toHaveLength(0);
        expect(result.success).toBe(false);
    });

    it("hands streamAIResponse's signal to the client it streams from", async () => {
        const {service, client} = mockOllamaClient({
            chat: async () => fakeAsyncStream([{message: {content: 'Hi'}}]),
        });
        let received: AbortSignal | undefined;

        providerOf(service).getOllama = async (signal?: AbortSignal) => {
            received = signal;

            return client;
        };

        const controller = new AbortController();

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm', undefined, controller.signal)) {
            void chunk;
        }

        expect(received).toBe(controller.signal);
    });
});

describe('OllamaService.streamAIResponse', () => {
    it('yields incremental chunks and a final chunk with the full accumulated reply', async () => {
        const {service} = mockOllamaClient({
            chat: async () => fakeAsyncStream([
                {message: {content: 'Hel'}},
                {message: {content: 'lo!'}},
            ]),
        });

        const chunks: any[] = [];

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual([
            {success: true, final: false, reply: 'Hel', thinking: undefined},
            {success: true, final: false, reply: 'Hello!', thinking: undefined},
            {success: true, final: true, reply: 'Hello!', thinking: undefined},
        ]);
    });

    it('accumulates the thinking field separately from the reply', async () => {
        const {service} = mockOllamaClient({
            chat: async () => fakeAsyncStream([
                {message: {content: 'A', thinking: 'reasoning-1 '}},
                {message: {content: 'B', thinking: 'reasoning-2'}},
            ]),
        });

        const chunks: any[] = [];

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm')) {
            chunks.push(chunk);
        }

        expect(chunks[chunks.length - 1]).toEqual({success: true, final: true, reply: 'AB', thinking: 'reasoning-1 reasoning-2'});
    });

    it('yields a single error chunk when the underlying chat call rejects', async () => {
        const {service} = mockOllamaClient({
            chat: async () => { throw new Error('stream failed'); },
        });

        const chunks: any[] = [];

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual([{success: false, error: 'stream failed'}]);
    });

    it('sends think:false and no options key at all when given no settings', async () => {
        let received: Record<string, unknown> = {};
        const {service} = mockOllamaClient({
            chat: async (request: Record<string, unknown>) => {
                received = request;

                return fakeAsyncStream([{message: {content: 'ok'}}]);
            },
        });

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm')) {
            expect(chunk.success).toBe(true);
        }

        expect(received.think).toBe(false);
        expect('options' in received).toBe(false);
    });

    it('merges temperature and contextWindow into ONE options object', async () => {
        let received: Record<string, unknown> = {};
        const {service} = mockOllamaClient({
            chat: async (request: Record<string, unknown>) => {
                received = request;

                return fakeAsyncStream([{message: {content: 'ok'}}]);
            },
        });

        const settings = {think: true, temperature: 1.5, contextWindow: 8192};

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm', settings)) {
            expect(chunk.success).toBe(true);
        }

        expect(received.think).toBe(true);
        expect(received.options).toEqual({temperature: 1.5, num_ctx: 8192});
    });

    it('maps contextWindow onto num_ctx and omits temperature when only the window is set', async () => {
        let received: Record<string, unknown> = {};
        const {service} = mockOllamaClient({
            chat: async (request: Record<string, unknown>) => {
                received = request;

                return fakeAsyncStream([{message: {content: 'ok'}}]);
            },
        });

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm', {contextWindow: 2048})) {
            expect(chunk.success).toBe(true);
        }

        expect(received.options).toEqual({num_ctx: 2048});
        expect((received.options as Record<string, unknown>).contextWindow).toBeUndefined();
    });

    it('passes a reasoning level straight through instead of coercing it to a boolean', async () => {
        let received: Record<string, unknown> = {};
        const {service} = mockOllamaClient({
            chat: async (request: Record<string, unknown>) => {
                received = request;

                return fakeAsyncStream([{message: {content: 'ok'}}]);
            },
        });

        // gpt-oss ignores true/false outright and accepts only a level, so a string must survive
        // the trip rather than being flattened by a `=== true` check.
        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm', {think: 'high'})) {
            expect(chunk.success).toBe(true);
        }

        expect(received.think).toBe('high');
    });

    it('sends an explicit true when thinking is on without a level', async () => {
        let received: Record<string, unknown> = {};
        const {service} = mockOllamaClient({
            chat: async (request: Record<string, unknown>) => {
                received = request;

                return fakeAsyncStream([{message: {content: 'ok'}}]);
            },
        });

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm', {think: true})) {
            expect(chunk.success).toBe(true);
        }

        expect(received.think).toBe(true);
    });

    it('latches the token counts off the done part and reports them only on the final chunk', async () => {
        const {service} = mockOllamaClient({
            chat: async () => fakeAsyncStream([
                {message: {content: 'Hel'}},
                {message: {content: 'lo!'}, done: true, prompt_eval_count: 120, eval_count: 34},
            ]),
        });

        const chunks: any[] = [];

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm')) {
            chunks.push(chunk);
        }

        expect(chunks[0].promptEvalCount).toBeUndefined();
        expect(chunks[1].promptEvalCount).toBeUndefined();
        expect(chunks[2]).toEqual({
            success: true, final: true, reply: 'Hello!', thinking: undefined, promptEvalCount: 120, evalCount: 34
        });
    });

    it('leaves the counts absent — not zero — when Ollama never reports them', async () => {
        const {service} = mockOllamaClient({
            chat: async () => fakeAsyncStream([{message: {content: 'ok'}}]),
        });

        const chunks: StreamAiResponse[] = [];

        for await (const chunk of service.streamAIResponse([{role: MessageRole.USER, content: 'hi', images: []}], 'm')) {
            chunks.push(chunk);
        }

        const final = chunks[chunks.length - 1];

        expect('promptEvalCount' in final).toBe(false);
        expect('evalCount' in final).toBe(false);
    });
});

describe('OllamaService.fetchModelContextLength', () => {
    // A plain object, not a Map — which is what the real client produces, since show() is
    // just `response.json()`.
    const showing = (modelInfo: Record<string, unknown>) => ({
        show: async () => ({model_info: modelInfo}),
    });

    it('resolves the length via the declared architecture', async () => {
        const {service} = mockOllamaClient(showing({'general.architecture': 'llama', 'llama.context_length': 40960}));

        expect(await service.fetchModelContextLength('m')).toEqual({success: true, contextLength: 40960});
    });

    it('falls back to any *.context_length key when the architecture is missing', async () => {
        const {service} = mockOllamaClient(showing({'qwen3.context_length': 32768}));

        expect(await service.fetchModelContextLength('m')).toEqual({success: true, contextLength: 32768});
    });

    it('falls back when the declared architecture does not match the key that exists', async () => {
        const {service} = mockOllamaClient(showing({'general.architecture': 'bogus', 'qwen3.context_length': 8192}));

        expect(await service.fetchModelContextLength('m')).toEqual({success: true, contextLength: 8192});
    });

    it('returns a null length when the model reports none', async () => {
        const {service} = mockOllamaClient(showing({'general.architecture': 'llama'}));

        expect(await service.fetchModelContextLength('m')).toEqual({success: true, contextLength: null});
    });

    it('fails rather than caching a null when show() throws', async () => {
        const {service} = mockOllamaClient({show: async () => { throw new Error('host unreachable'); }});

        expect(await service.fetchModelContextLength('m')).toEqual({success: false, error: 'host unreachable'});
    });
});

describe('OllamaService.pullModel', () => {
    it('yields only when progress increases, and stops at 100', async () => {
        const {service} = mockOllamaClient({
            pull: async () => fakeAsyncStream([
                {total: 100, completed: 10},
                {total: 100, completed: 10}, // no change — should not yield again
                {total: 100, completed: 55},
                {total: 100, completed: 100},
            ]),
        });

        const chunks: any[] = [];

        for await (const chunk of service.pullModel('llama3')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual([
            {success: true, reply: 10},
            {success: true, reply: 55},
            {success: true, reply: 100},
        ]);
    });

    it('yields a single error chunk when the pull call rejects', async () => {
        const {service} = mockOllamaClient({
            pull: async () => { throw new Error('disk full'); },
        });

        const chunks: any[] = [];

        for await (const chunk of service.pullModel('llama3')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual([{success: false, error: 'disk full'}]);
    });
});

describe('OllamaService singleton', () => {
    it('getInstance always returns the same instance until reloadInstance is called', () => {
        OllamaService.reloadInstance();

        const a = OllamaService.getInstance();
        const b = OllamaService.getInstance();

        expect(a).toBe(b);

        OllamaService.reloadInstance();

        const c = OllamaService.getInstance();

        expect(c).not.toBe(a);
    });

    it('calling `new OllamaService()` directly while an instance exists returns that same instance', () => {
        OllamaService.reloadInstance();

        const existing = OllamaService.getInstance();
        const viaConstructor = new OllamaService();

        expect(viaConstructor).toBe(existing);
    });

    it('getInstance creates a fresh instance when none exists yet', () => {
        (OllamaService as any).instance = null;

        const created = OllamaService.getInstance();

        expect(created).toBeInstanceOf(OllamaService);
        expect(OllamaService.getInstance()).toBe(created);
    });
});
