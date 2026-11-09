/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {isModelGone, modelOptions, useFetchModels} from './useFetchModels';
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

    it('finds an untagged name under the default tag Ollama lists it by', () => {
        expect(isModelGone('llama3', ['llama3:latest'])).toBe(false);
        expect(isModelGone('llama3:8b', ['llama3:latest'])).toBe(true);
    });
});

describe('modelOptions', () => {
    it('adds the saved model while the list does not show it, so the field never looks emptied', () => {
        expect(modelOptions('gemma3:27b', [])).toEqual(['gemma3:27b']);
        expect(modelOptions('llama3', ['llama3:latest'])).toEqual(['llama3', 'llama3:latest']);
    });

    it('is the list itself when it shows the saved model, or nothing is saved', () => {
        const models = ['gemma3:27b', 'qwen3:32b'];

        expect(modelOptions('qwen3:32b', models)).toBe(models);
        expect(modelOptions('', models)).toBe(models);
        expect(modelOptions(undefined, models)).toBe(models);
    });
});
