/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {isModelGone, useFetchModels} from './useFetchModels';
import {OllamaService} from '../services/ollamaService';


describe('useFetchModels', () => {
    beforeEach(() => {
        OllamaService.reloadInstance();
    });

    afterEach(() => {
        cleanup();
    });

    it('resolves with null, not an empty list, when Ollama cannot be reached', async () => {
        OllamaService.getInstance().fetchModels = async () => ({success: false, error: 'daemon not running'});

        const onError = vi.fn();
        const {result} = renderHook(() => useFetchModels(onError));
        let names: string[] | null = [];

        await act(async () => {
            names = await result.current.fetchModels();
        });

        expect(names).toBeNull();
        expect(result.current.reachable).toBe(false);
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('daemon not running'));
    });

    it('resolves with the names Ollama lists, an empty list included', async () => {
        OllamaService.getInstance().fetchModels = async () => ({success: true, models: []});

        const {result} = renderHook(() => useFetchModels());
        let names: string[] | null = null;

        await act(async () => {
            names = await result.current.fetchModels();
        });

        expect(names).toEqual([]);
        expect(result.current.reachable).toBe(true);
    });
});

describe('isModelGone', () => {
    it('is true only when a list came back without the model', () => {
        expect(isModelGone('llama3', ['qwen3'])).toBe(true);
        expect(isModelGone('llama3', [])).toBe(true);
        expect(isModelGone('llama3', ['llama3', 'qwen3'])).toBe(false);
        expect(isModelGone('llama3', null)).toBe(false);
        expect(isModelGone('', ['qwen3'])).toBe(false);
        expect(isModelGone(undefined, null)).toBe(false);
    });
});
