/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {beforeEach, describe, expect, it} from 'vitest';
import {OllamaService} from './ollamaService';
import {MessageRole} from '../types/ollama.types';

type CannedResponse = {message: {role: string; content?: string; tool_calls?: any[]}};

/** Mocks only `callOllamaChat` — everything else (the loop, recovery, retries, tool
 * execution) runs for real, against the actual implementation. */
function mockService (mockResponses: CannedResponse[]) {
    OllamaService.reloadInstance();

    const service = OllamaService.getInstance();
    let callIndex = 0;
    const receivedArgs: any[][] = [];

    (service as any).callOllamaChat = async (...args: any[]) => {
        receivedArgs.push(args);

        const next = mockResponses[callIndex++];

        if (!next) throw new Error(`Mock ran out of responses at call #${callIndex}`);

        return next;
    };

    return {service, getCallCount: () => callIndex, receivedArgs};
}

/** Mocks `getOllama` to return a fake client — for the methods that talk to Ollama
 * directly (list/pull/delete/abort/streaming chat) rather than through `callOllamaChat`. */
function mockOllamaClient (overrides: Partial<Record<'list' | 'chat' | 'pull' | 'delete' | 'abort', any>>) {
    OllamaService.reloadInstance();

    const service = OllamaService.getInstance();
    const client = {list: undefined, chat: undefined, pull: undefined, delete: undefined, abort: undefined, ...overrides};

    (service as any).getOllama = async () => client;

    return {service, client};
}

async function* fakeAsyncStream<T> (chunks: T[]): AsyncGenerator<T> {
    for (const chunk of chunks) yield chunk;
}

function makeTools (handlerLog: any[], requireToolUse = true, handlerResult: any = {success: true}) {
    return [{
        schema: {name: 'formInteraction', description: '', parameters: {} as any},
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

    it('throws a clear error when the model calls a tool that was never registered', async () => {
        const handlerLog: any[] = [];
        const {service} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'someUnknownTool')]}},
        ]);

        const result = await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools: makeTools(handlerLog),
            maxToolRetries: 3,
        });

        expect(handlerLog).toHaveLength(0);
        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/Tool not found: someUnknownTool/);
    });

    it('passes a string tool result through as-is, without JSON-stringifying it', async () => {
        const {service, receivedArgs} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Reported back.'}},
        ]);

        const tools = [{
            schema: {name: 'formInteraction', description: '', parameters: {} as any},
            systemUserConfigValues: {requireToolUse: true},
            handler: async () => 'a plain string result',
        }];

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 3,
        });

        // The 2nd callOllamaChat invocation's `messages` arg should carry the raw string,
        // not a JSON-stringified version of it.
        const secondCallMessages = receivedArgs[1][1];
        const toolResultMessage = secondCallMessages.find((m: any) => m.content === 'a plain string result');

        expect(toolResultMessage).toBeDefined();
    });

    it('preserves extra context fields (not just .error) in the message sent back to the model on tool error', async () => {
        const {service, receivedArgs} = mockService([
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall()]}},
            {message: {role: 'assistant', content: 'Understood.'}},
        ]);

        const tools = [{
            schema: {name: 'formInteraction', description: '', parameters: {} as any},
            systemUserConfigValues: {requireToolUse: true},
            handler: async () => ({error: 'Submit blocked', formFields: [{name: 'email', required: true}]}),
        }];

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'fill', images: []}],
            model: 'm',
            tools,
            maxToolRetries: 1,
        });

        const secondCallMessages = receivedArgs[1][1]; // (ollama, messages, ...) — messages is arg index 1
        const toolResultMessage = secondCallMessages.find((m: any) => m.content?.includes('Submit blocked'));

        expect(toolResultMessage.content).toContain('formFields');
        expect(toolResultMessage.content).toContain('email');
    });

    it('nudges only for required tools not yet called when there are several', async () => {
        const handlerLog: {tool: string}[] = [];
        const {service, receivedArgs} = mockService([
            // Neither required tool called on the first turn.
            {message: {role: 'assistant', content: 'thinking...'}},
            // Second turn: both get called.
            {message: {role: 'assistant', content: '', tool_calls: [nativeToolCall({}, 'toolA'), nativeToolCall({}, 'toolB')]}},
            {message: {role: 'assistant', content: 'Both tools used.'}},
        ]);

        const tools = [
            {
                schema: {name: 'toolA', description: '', parameters: {} as any},
                systemUserConfigValues: {requireToolUse: true},
                handler: async () => {
                    handlerLog.push({tool: 'toolA'});

                    return {success: true};
                },
            },
            {
                schema: {name: 'toolB', description: '', parameters: {} as any},
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

        // The nudge pushed before the 2nd callOllamaChat call should mention both tool names.
        const secondCallMessages = receivedArgs[1][1];
        const nudge = secondCallMessages.find((m: any) => m.content?.includes('must call'));

        expect(nudge.content).toContain('toolA');
        expect(nudge.content).toContain('toolB');
    });

    it('JSON-stringifies non-string message content before sending it to Ollama', async () => {
        const {service, receivedArgs} = mockService([
            {message: {role: 'assistant', content: 'ok'}},
        ]);

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: {nested: 'object'} as any, images: []}],
            model: 'm',
            maxToolRetries: 3,
        });

        const firstCallMessages = receivedArgs[0][1];

        expect(firstCallMessages[0].content).toBe(JSON.stringify({nested: 'object'}));
    });

    it('extracts base64 images out of markdown-image syntax in message content', async () => {
        const {service, receivedArgs} = mockService([
            {message: {role: 'assistant', content: 'ok'}},
        ]);

        await service.fetchAIResponse({
            messages: [{role: MessageRole.USER, content: 'Look: ![pic](data:image/png;base64,ABCD1234)', images: []}],
            model: 'm',
            maxToolRetries: 3,
        });

        const firstCallMessages = receivedArgs[0][1];

        expect(firstCallMessages[0].content).not.toContain('data:image');
        expect(firstCallMessages[0].images).toEqual(['ABCD1234']);
    });

    it('passes format/think/temperature through to every callOllamaChat invocation', async () => {
        const {service, receivedArgs} = mockService([
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

        // (ollama, messages, model, format, tools, think, temperature)
        const [, , model, format, , think, temperature] = receivedArgs[0];

        expect(model).toBe('m');
        expect(format).toEqual({type: 'object'});
        expect(think).toBe(true);
        expect(temperature).toBe(0.3);
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
                schema: {name: 'formInteraction', description: '', parameters: {} as any},
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
                    schema: {name: 'toolA', description: '', parameters: {} as any},
                    systemUserConfigValues: {requireToolUse: true},
                    handler: async () => {
                        handlerLog.push({tool: 'toolA'});

                        return {success: true};
                    },
                },
                {
                    schema: {name: 'toolB', description: '', parameters: {} as any},
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

describe('OllamaService (private) callOllamaChat', () => {
    it('builds the request with stream:false and a 60m keep_alive, and returns the client response as-is', async () => {
        OllamaService.reloadInstance();

        const service = OllamaService.getInstance() as any;
        let receivedArgs: any;
        const client = {
            chat: async (args: any) => {
                receivedArgs = args;

                return {message: {role: 'assistant', content: 'hi'}};
            },
        };

        const result = await service.callOllamaChat(client, [{role: MessageRole.USER, content: 'hello', images: []}], 'm');

        expect(receivedArgs).toMatchObject({
            model: 'm',
            stream: false,
            keep_alive: '60m',
        });
        expect(receivedArgs).not.toHaveProperty('think');
        expect(receivedArgs).not.toHaveProperty('options');
        expect(result).toEqual({message: {role: 'assistant', content: 'hi'}});
    });

    it('includes think and options.temperature only when explicitly provided', async () => {
        OllamaService.reloadInstance();

        const service = OllamaService.getInstance() as any;
        let receivedArgs: any;
        const client = {
            chat: async (args: any) => {
                receivedArgs = args;

                return {message: {role: 'assistant', content: 'hi'}};
            },
        };

        await service.callOllamaChat(
            client, [{role: MessageRole.USER, content: 'hello', images: []}], 'm', {type: 'object'}, undefined, true, 0.7
        );

        expect(receivedArgs.think).toBe(true);
        expect(receivedArgs.options).toEqual({temperature: 0.7});
        expect(receivedArgs.format).toEqual({type: 'object'});
    });
});

describe('OllamaService (private) recoverToolCallFromContent', () => {
    function recover (content: string | undefined, toolNames: string[] = ['formInteraction']) {
        OllamaService.reloadInstance();

        const service = OllamaService.getInstance() as any;
        const response: {message: {role: string; content?: string; tool_calls?: any[]}} = {message: {role: 'assistant', content}};

        service.recoverToolCallFromContent(response, toolNames.map(name => ({schema: {name}})));

        return response;
    }

    it('recovers the nested { function: { name, arguments } } shape', () => {
        const response = recover(JSON.stringify({function: {name: 'formInteraction', arguments: {url: 'http://x'}}}));

        expect(response.message.tool_calls).toEqual([{function: {name: 'formInteraction', arguments: {url: 'http://x'}}}]);
        expect(response.message.content).toBe('');
    });

    it('recovers the flat { name, arguments } shape, normalizing it into the nested one', () => {
        const response = recover(JSON.stringify({name: 'formInteraction', arguments: {url: 'http://x'}}));

        expect(response.message.tool_calls).toEqual([{function: {name: 'formInteraction', arguments: {url: 'http://x'}}}]);
    });

    it('strips ```json fences before parsing', () => {
        const response = recover('```json\n' + JSON.stringify({name: 'formInteraction', arguments: {}}) + '\n```');

        expect(response.message.tool_calls).toHaveLength(1);
    });

    it('recovers a JSON object embedded in stray surrounding text', () => {
        const response = recover(
            `Sure! ${JSON.stringify({name: 'formInteraction', arguments: {url: 'http://x'}})} — done.`
        );

        expect(response.message.tool_calls).toHaveLength(1);
    });

    it('recovers a JSON object with quoted values containing literal braces, without miscounting depth', () => {
        // extractBalancedJsonObject must not let a `{`/`}` inside a string value throw off
        // its brace-depth counter.
        const response = recover(
            `garbage-before ${JSON.stringify({name: 'formInteraction', arguments: {note: 'a {literal} brace pair'}})} trailing`
        );

        expect(response.message.tool_calls).toEqual([
            {function: {name: 'formInteraction', arguments: {note: 'a {literal} brace pair'}}},
        ]);
    });

    it('handles an escaped quote inside a string value without ending the string early', () => {
        // A literal `"` inside a string value becomes `\"` once JSON-serialized; the scanner
        // must not mistake that escaped quote for the string's real closing quote.
        const payload = JSON.stringify({name: 'formInteraction', arguments: {note: 'she said "hi" to me'}});
        const response = recover(`garbage-before ${payload} trailing`);

        expect(response.message.tool_calls).toEqual([
            {function: {name: 'formInteraction', arguments: {note: 'she said "hi" to me'}}},
        ]);
    });

    it('does not recover when there is no "{" anywhere in the content', () => {
        const response = recover('just plain text with no braces at all');

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('does not recover an object that never closes its braces', () => {
        const response = recover('leading text {"name": "formInteraction", "arguments": {');

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('does not recover a brace-balanced substring that is not actually valid JSON', () => {
        // Balanced braces (depth returns to 0) but unquoted keys/values — a valid target
        // for extractBalancedJsonObject to find, but JSON.parse on it must still fail cleanly.
        const response = recover('xxx {not: valid, json: here} yyy');

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('does not recover when the tool name is not among the available tools', () => {
        const response = recover(JSON.stringify({name: 'someOtherTool', arguments: {}}));

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('does not touch plain prose that happens to not be JSON', () => {
        const response = recover('The form has been submitted successfully.');

        expect(response.message.tool_calls).toBeUndefined();
        expect(response.message.content).toBe('The form has been submitted successfully.');
    });

    it('is a no-op when tool_calls are already populated', () => {
        OllamaService.reloadInstance();

        const service = OllamaService.getInstance() as any;
        const existingCalls = [{function: {name: 'formInteraction', arguments: {}}}];
        const response = {message: {role: 'assistant', content: 'ignored', tool_calls: existingCalls}};

        service.recoverToolCallFromContent(response, [{schema: {name: 'formInteraction'}}]);

        expect(response.message.tool_calls).toBe(existingCalls);
        expect(response.message.content).toBe('ignored');
    });

    it('is a no-op when no tools are available at all (undefined)', () => {
        OllamaService.reloadInstance();

        const service = OllamaService.getInstance() as any;
        const response: {message: {role: string; content?: string; tool_calls?: any[]}} =
            {message: {role: 'assistant', content: JSON.stringify({name: 'formInteraction', arguments: {}})}};

        service.recoverToolCallFromContent(response, undefined);

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('is a no-op when the tools array is empty', () => {
        OllamaService.reloadInstance();

        const service = OllamaService.getInstance() as any;
        const response: {message: {role: string; content?: string; tool_calls?: any[]}} =
            {message: {role: 'assistant', content: JSON.stringify({name: 'formInteraction', arguments: {}})}};

        service.recoverToolCallFromContent(response, []);

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('is a no-op when content is empty/undefined', () => {
        const empty = recover('');
        const undef = recover(undefined);

        expect(empty.message.tool_calls).toBeUndefined();
        expect(undef.message.tool_calls).toBeUndefined();
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
        let receivedArgs: any;
        const {service} = mockOllamaClient({
            delete: async (args: any) => { receivedArgs = args; },
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

describe('OllamaService.abortAIResponse', () => {
    it('reports success after calling abort on the client', async () => {
        let aborted = false;
        const {service} = mockOllamaClient({
            abort: () => { aborted = true; },
        });

        const result = await service.abortAIResponse();

        expect(result).toEqual({success: true});
        expect(aborted).toBe(true);
    });

    it('returns an error response when abort itself throws', async () => {
        const {service} = mockOllamaClient({
            abort: () => { throw new Error('nothing to abort'); },
        });

        const result = await service.abortAIResponse();

        expect(result).toEqual({success: false, error: 'nothing to abort'});
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

describe('OllamaService host handling (getOllama)', () => {
    beforeEach(() => {
        localStorage.clear();
        OllamaService.reloadInstance();
    });

    it('reuses the same client across calls when the configured host has not changed', async () => {
        localStorage.setItem('ollamaHost', 'http://host-a');

        const service = OllamaService.getInstance() as any;

        await service.getOllama();
        const firstClient = service.ollama;

        await service.getOllama();
        const secondClient = service.ollama;

        expect(secondClient).toBe(firstClient);
    });

    it('constructs a new client when the configured host changes', async () => {
        localStorage.setItem('ollamaHost', 'http://host-a');

        const service = OllamaService.getInstance() as any;

        await service.getOllama();
        const firstClient = service.ollama;

        localStorage.setItem('ollamaHost', 'http://host-b');
        await service.getOllama();
        const secondClient = service.ollama;

        expect(secondClient).not.toBe(firstClient);
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
