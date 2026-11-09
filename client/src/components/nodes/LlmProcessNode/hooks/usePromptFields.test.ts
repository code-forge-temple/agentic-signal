/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {usePromptFields} from './usePromptFields';
import {defaultLlmProcessNodeData, LlmProcessNodeData} from '../types/workflow';


const wait = (ms: number) => act(() => {
    vi.advanceTimersByTime(ms);
});

// The node's settings, changed the way the workflow changes them: the new values replace the old ones.
function nodeData (initial: Partial<LlmProcessNodeData>) {
    const node = {data: {...defaultLlmProcessNodeData, ...initial}};
    const change = vi.fn((changes: Partial<LlmProcessNodeData>) => {
        node.data = {...node.data, ...changes};
    });

    return {node, change};
}

describe('usePromptFields', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('keeps the prefix saved while the suffix was still waiting', () => {
        const {node, change} = nodeData({message: {prefix: '', suffix: ''}});
        const {result, rerender} = renderHook(() => usePromptFields(node.data, change));

        act(() => result.current.prefix[1]('Before: '));
        wait(100);
        act(() => result.current.suffix[1](' :After'));
        wait(200);
        expect(node.data.message).toEqual({prefix: 'Before: ', suffix: ''});

        rerender();
        wait(100);
        expect(node.data.message).toEqual({prefix: 'Before: ', suffix: ' :After'});
    });

    it('keeps both texts when both saves come before the next render (timers held back in a background tab)', () => {
        const {node, change} = nodeData({message: {prefix: '', suffix: ''}});
        const {result} = renderHook(() => usePromptFields(node.data, change));

        act(() => result.current.prefix[1]('Before: '));
        wait(100);
        act(() => result.current.suffix[1](' :After'));
        wait(300);

        expect(node.data.message).toEqual({prefix: 'Before: ', suffix: ' :After'});
    });

    it('keeps the On Success schema saved while On Error was still waiting', () => {
        const {node, change} = nodeData({format: {}});
        const {result, rerender} = renderHook(() => usePromptFields(node.data, change));

        act(() => result.current.onSuccess[1]('{"type":"object"}'));
        wait(100);
        act(() => result.current.onError[1]('{"type":"string"}'));
        wait(200);

        rerender();
        wait(100);
        expect(node.data.format).toEqual({onSuccess: '{"type":"object"}', onError: '{"type":"string"}'});
    });
});
