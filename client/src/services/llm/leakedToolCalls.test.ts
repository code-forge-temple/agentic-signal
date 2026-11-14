/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {recoverToolCallFromContent} from './leakedToolCalls';


describe('recoverToolCallFromContent', () => {
    function recover (content: string | undefined, toolNames: string[] = ['formInteraction']) {
        const response: {message: {role: string; content?: string; tool_calls?: any[]}} = {message: {role: 'assistant', content}};

        recoverToolCallFromContent(response, toolNames.map(name => ({schema: {name}})));

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
        const existingCalls = [{function: {name: 'formInteraction', arguments: {}}}];
        const response = {message: {role: 'assistant', content: 'ignored', tool_calls: existingCalls}};

        recoverToolCallFromContent(response, [{schema: {name: 'formInteraction'}}]);

        expect(response.message.tool_calls).toBe(existingCalls);
        expect(response.message.content).toBe('ignored');
    });

    it('is a no-op when no tools are available at all (undefined)', () => {
        const response: {message: {role: string; content?: string; tool_calls?: any[]}} =
            {message: {role: 'assistant', content: JSON.stringify({name: 'formInteraction', arguments: {}})}};

        recoverToolCallFromContent(response, undefined);

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('is a no-op when the tools array is empty', () => {
        const response: {message: {role: string; content?: string; tool_calls?: any[]}} =
            {message: {role: 'assistant', content: JSON.stringify({name: 'formInteraction', arguments: {}})}};

        recoverToolCallFromContent(response, []);

        expect(response.message.tool_calls).toBeUndefined();
    });

    it('is a no-op when content is empty/undefined', () => {
        const empty = recover('');
        const undef = recover(undefined);

        expect(empty.message.tool_calls).toBeUndefined();
        expect(undef.message.tool_calls).toBeUndefined();
    });
});
