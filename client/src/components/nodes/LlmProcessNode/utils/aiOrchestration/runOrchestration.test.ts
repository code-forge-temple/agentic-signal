/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {beforeEach, describe, expect, it} from 'vitest';
import {runOrchestration} from './runOrchestration';
import {OllamaService} from '../../../../../services/ollamaService';
import {FetchAiResponse} from '../../../../../types/ollama.types';
import {OrchestrationParams} from './types';

/** Mocks the public `fetchAIResponse` directly — isolates runOrchestration's own
 * planning/dependency/aggregation logic from the tool-calling loop, which has its
 * own dedicated coverage in ollamaService.test.ts. */
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

function baseParams (overrides: Partial<OrchestrationParams> = {}): OrchestrationParams {
    return {
        input: ['url-1', 'url-2'],
        model: 'm',
        maxToolRetries: 3,
        ...overrides,
    };
}

describe('runOrchestration', () => {
    beforeEach(() => {
        OllamaService.reloadInstance();
    });

    it('runs planning -> one agent call per task -> aggregation, and returns the raw aggregation reply', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'do the thing'}]})),
            success('the thing is done'),
            success('Final summary: the thing is done.'),
        ]);

        const result = await runOrchestration(baseParams({input: ['one task']}));

        expect(result).toEqual({success: true, result: 'Final summary: the thing is done.'});
    });

    it('builds a planning system prompt from just the schema when no node-level prompt is configured', async () => {
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('response'),
            success('Done.'),
        ]);

        await runOrchestration(baseParams({prompt: undefined}));

        const planningSystemMessage = receivedCalls[0].messages.find((m: any) => m.role === 'system');

        expect(planningSystemMessage.content.startsWith('Your response must be valid JSON')).toBe(true);
    });

    it('builds an aggregation system prompt from just the format schema when no node-level prompt is configured', async () => {
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('response'),
            success(JSON.stringify({status: 'ok'})),
        ]);

        await runOrchestration(baseParams({
            prompt: undefined,
            format: {onSuccess: JSON.stringify({type: 'object', properties: {status: {type: 'string'}}})},
        }));

        const aggregationSystemMessage = receivedCalls[2].messages.find((m: any) => m.role === 'system');

        expect(aggregationSystemMessage.content.startsWith('Your response must be valid JSON')).toBe(true);
    });

    it('runs one agent call per planned task, in order', async () => {
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'task A'}, {content: 'task B'}]})),
            success('A done'),
            success('B done'),
            success('Both done.'),
        ]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: true, result: 'Both done.'});
        // call 0 = planning, call 1 = agent for task A, call 2 = agent for task B, call 3 = aggregation
        expect(receivedCalls[1].messages.at(-1).content).toContain('task A');
        expect(receivedCalls[2].messages.at(-1).content).toContain('task B');
    });

    it('injects a prior task\'s output as context for a task that depends on it', async () => {
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [
                {content: 'produce a value'},
                {content: 'use the prior value', dependsOn: [0]},
            ]})),
            success('the produced value is 42'),
            success('used 42 successfully'),
            success('Done.'),
        ]);

        await runOrchestration(baseParams());

        const secondAgentMessage = receivedCalls[2].messages.at(-1).content;

        expect(secondAgentMessage).toContain('the produced value is 42');
        expect(secondAgentMessage).toContain('use the prior value');
    });

    it('uses a task-specific systemPrompt override instead of the node-level prompt for that task', async () => {
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x', systemPrompt: 'You are a specialist.'}]})),
            success('specialist response'),
            success('Done.'),
        ]);

        await runOrchestration(baseParams({prompt: 'Generic node prompt'}));

        const agentSystemMessage = receivedCalls[1].messages.find((m: any) => m.role === 'system');

        expect(agentSystemMessage.content).toBe('You are a specialist.');
    });

    it('falls back to the node-level prompt for a task with no systemPrompt override', async () => {
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('response'),
            success('Done.'),
        ]);

        await runOrchestration(baseParams({prompt: 'Generic node prompt'}));

        const agentSystemMessage = receivedCalls[1].messages.find((m: any) => m.role === 'system');

        expect(agentSystemMessage.content).toBe('Generic node prompt');
    });

    it('resolves and passes only the tools a task was assigned', async () => {
        const handlerLog: string[] = [];
        const tools = [
            {
                schema: {name: 'toolA', description: '', parameters: {} as any},
                systemUserConfigValues: {requireToolUse: false},
                handler: async () => {
                    handlerLog.push('toolA');

                    return {success: true};
                },
            },
            {
                schema: {name: 'toolB', description: '', parameters: {} as any},
                systemUserConfigValues: {requireToolUse: false},
                handler: async () => {
                    handlerLog.push('toolB');

                    return {success: true};
                },
            },
        ];
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x', tools: ['toolA']}]})),
            success('used toolA'),
            success('Done.'),
        ]);

        await runOrchestration(baseParams({tools}));

        const agentToolNames = receivedCalls[1].tools.map((t: any) => t.schema.name);

        expect(agentToolNames).toEqual(['toolA']);
    });

    it('passes no tools to the planning call (format-constrained output and tool_calls are mutually exclusive)', async () => {
        const tools = [{
            schema: {name: 'toolA', description: '', parameters: {} as any},
            systemUserConfigValues: {requireToolUse: false},
            handler: async () => ({success: true}),
        }];
        const {receivedCalls} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('response'),
            success('Done.'),
        ]);

        await runOrchestration(baseParams({tools}));

        expect(receivedCalls[0].tools).toBeUndefined();
    });

    it('fails with a clear error when the planning call itself fails', async () => {
        mockFetchAIResponse([failure('model unreachable')]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: false, error: 'Orchestrator planning failed: model unreachable'});
    });

    it('fails when the planning reply is not valid JSON', async () => {
        mockFetchAIResponse([success('not json at all')]);

        const result = await runOrchestration(baseParams());

        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/Failed to parse orchestrator plan/);
    });

    it('fails when the plan has an empty task list', async () => {
        mockFetchAIResponse([success(JSON.stringify({tasks: []}))]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: false, error: 'Orchestrator returned an empty task list.'});
    });

    it('drops tasks with empty/missing content but proceeds with the valid ones', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: ''}, {content: '   '}, {content: 'real task'}]})),
            success('real task done'),
            success('Done.'),
        ]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: true, result: 'Done.'});
    });

    it('fails when every task in the plan has empty content', async () => {
        mockFetchAIResponse([success(JSON.stringify({tasks: [{content: ''}, {content: '  '}]}))]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: false, error: 'Orchestrator returned an empty task list.'});
    });

    it('fails and stops immediately when an agent call fails partway through the task list', async () => {
        const {getCallCount} = mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'task A'}, {content: 'task B'}]})),
            failure('agent crashed'),
        ]);

        const result = await runOrchestration(baseParams());

        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/Agent call failed for task "task A/);
        expect((result as any).error).toContain('agent crashed');
        // Never attempted task B or aggregation after task A's agent call failed.
        expect(getCallCount()).toBe(2);
    });

    it('fails with a clear error when the aggregation call fails', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('agent response'),
            failure('aggregation model down'),
        ]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: false, error: 'Aggregation call failed: aggregation model down'});
    });

    it('parses the aggregation reply as an object when the format schema expects one', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('agent response'),
            success(JSON.stringify({status: 'ok', count: 2})),
        ]);

        const result = await runOrchestration(baseParams({
            format: {onSuccess: JSON.stringify({type: 'object', properties: {status: {type: 'string'}}})},
        }));

        expect(result).toEqual({success: true, result: {status: 'ok', count: 2}});
    });

    it('fails when the aggregation reply cannot be parsed as the object the format schema expects', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('agent response'),
            success('][}{'), // genuinely unparseable, even through the dirty-json sanitizer fallback
        ]);

        const result = await runOrchestration(baseParams({
            format: {onSuccess: JSON.stringify({type: 'object'})},
        }));

        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/Failed to parse aggregation response/);
    });

    it('fails when the aggregation result matches the onError schema', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('agent response'),
            success(JSON.stringify({error: 'could not complete'})),
        ]);

        const result = await runOrchestration(baseParams({
            format: {
                onSuccess: JSON.stringify({type: 'object', properties: {status: {type: 'string'}}}),
                onError: JSON.stringify({type: 'object', required: ['error'], properties: {error: {type: 'string'}}}),
            },
        }));

        expect(result.success).toBe(false);
        expect((result as any).error).toContain('onError schema');
    });

    it('fails with a clear error when the format schema itself is invalid JSON', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('agent response'),
        ]);

        const result = await runOrchestration(baseParams({format: {onSuccess: 'not valid json {{'}}));

        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/Invalid aggregation format schema/);
    });

    it('leaves the aggregation reply as a plain string when no format is configured', async () => {
        mockFetchAIResponse([
            success(JSON.stringify({tasks: [{content: 'x'}]})),
            success('agent response'),
            success('  plain text summary  '),
        ]);

        const result = await runOrchestration(baseParams());

        expect(result).toEqual({success: true, result: '  plain text summary  '});
    });
});
