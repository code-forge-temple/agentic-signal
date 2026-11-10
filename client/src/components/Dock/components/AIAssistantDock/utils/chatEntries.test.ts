/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {contextUsageOf, historyBefore, importFailureMessage, usedTokens, withCurrentWorkflow, withReplyReplaced, withReplyText} from './chatEntries';
import {ChatEntry, EMPTY_CONTEXT_USAGE} from '../constants';


const user = (content: string): ChatEntry => ({role: 'user', content});
const reply = (content: string, extra = {}): ChatEntry => ({role: 'assistant', content, ...extra});
const notice = (model: string, previousModel: string): ChatEntry => ({role: 'notice', model, previousModel});

describe('the streamed reply', () => {
    it('shows the text and thinking so far in the last entry, a reply', () => {
        expect(withReplyText([user('hi'), reply('')], {reply: 'Hel', thinking: 'hmm'})).toEqual([user('hi'), reply('Hel', {thinking: 'hmm'})]);
    });

    it('is replaced by an error, which keeps the command results it answered from', () => {
        const results = {label: 'Results of /weather', content: '...'};

        expect(withReplyReplaced([reply('half', {commandResults: results, thinking: 't'})], 'Error: down'))
            .toEqual([reply('Error: down', {commandResults: results})]);
    });

    it('leaves the chat as it is when the last entry is not a reply', () => {
        const entries = [reply('a'), user('b')];

        expect(withReplyText(entries, {reply: 'x'})).toBe(entries);
        expect(withReplyReplaced(entries, 'x')).toBe(entries);
    });
});

describe('the context reading', () => {
    it('counts the prompt and the reply of the model that measured it', () => {
        expect(contextUsageOf('qwen3', {promptEvalCount: 100, evalCount: 20})).toEqual({model: 'qwen3', promptTokens: 100, replyTokens: 20});
        expect(contextUsageOf('qwen3', {evalCount: 20})).toEqual({model: 'qwen3', promptTokens: 0, replyTokens: 20});
    });

    it('is empty when Ollama reported neither count', () => {
        expect(contextUsageOf('qwen3', {})).toBe(EMPTY_CONTEXT_USAGE);
    });

    it('counts for the selected model only', () => {
        const usage = {model: 'qwen3', promptTokens: 100, replyTokens: 20};

        expect(usedTokens(usage, 'qwen3')).toBe(120);
        expect(usedTokens(usage, 'gemma3')).toBe(0);
    });
});

describe('historyBefore', () => {
    it('is the chat before the message', () => {
        const entries = [user('a'), reply('b'), user('c'), reply('d')];

        expect(historyBefore(entries, 2, 'qwen3')).toEqual([user('a'), reply('b')]);
    });

    it('draws again a model switch among the dropped entries that still holds', () => {
        const entries = [user('a'), reply('b'), user('c'), notice('qwen3', 'gemma3'), reply('d')];

        expect(historyBefore(entries, 2, 'qwen3')).toEqual([user('a'), reply('b'), notice('qwen3', 'gemma3')]);
    });

    it('leaves out a dropped switch back to the model in use', () => {
        const entries = [user('a'), user('c'), notice('qwen3', 'gemma3')];

        expect(historyBefore(entries, 1, 'gemma3')).toEqual([user('a')]);
    });
});

describe('message text', () => {
    it('puts the shown workflow\'s JSON in place of @current-workflow', () => {
        const text = withCurrentWorkflow('fix @current-workflow please', () => '{"nodes":[]}');

        expect(text).toBe('fix current workflow:\n\n```json\n{"nodes":[]}\n```\n please');
    });

    it('tells the AI Buddy why its workflow failed to import', () => {
        expect(importFailureMessage('bad edge')).toBe('The workflow JSON you generated failed to import with this error: ```bad edge```\nPlease fix the JSON and try again.');
    });
});
