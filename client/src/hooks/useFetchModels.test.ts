/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {isModelGone, modelOptions, useFetchModels} from './useFetchModels';
import {LlmService} from '../services/llm/llmService';
import {useOllamaModels} from '../stores/ollamaModels';


describe('useFetchModels', () => {
    beforeEach(() => {
        LlmService.reloadInstance();
        useOllamaModels.setState({models: [], reachable: false, isFetching: false});
    });

    afterEach(() => {
        cleanup();
    });

    it('resolves with null, not an empty list, when Ollama cannot be reached', async () => {
        LlmService.getInstance().fetchModels = async () => ({success: false, error: 'daemon not running'});

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
        LlmService.getInstance().fetchModels = async () => ({success: true, models: []});

        const {result} = renderHook(() => useFetchModels());
        let names: string[] | null = null;

        await act(async () => {
            names = await result.current.fetchModels();
        });

        expect(names).toEqual([]);
        expect(result.current.reachable).toBe(true);
    });
});

describe('useFetchModels: one list for the app', () => {
    beforeEach(() => {
        LlmService.reloadInstance();
        useOllamaModels.setState({models: [], reachable: false, isFetching: false});
    });

    afterEach(() => {
        cleanup();
    });

    it('updates the list of every user when any of them fetches (a model pulled in Settings reaches the chat and the nodes)', async () => {
        LlmService.getInstance().fetchModels = async () => ({success: true, models: [{name: 'a'}]});
        const settings = renderHook(() => useFetchModels());
        const chat = renderHook(() => useFetchModels());

        await act(async () => {
            await settings.result.current.fetchModels();
        });
        expect(chat.result.current.models).toEqual(['a']);

        LlmService.getInstance().fetchModels = async () => ({success: true, models: [{name: 'a'}, {name: 'b'}]});
        await act(async () => {
            await settings.result.current.fetchModels();
        });
        expect([chat.result.current.models, chat.result.current.reachable]).toEqual([['a', 'b'], true]);
    });

    it('reports a failed fetch to the user that made it only, while every list empties', async () => {
        LlmService.getInstance().fetchModels = async () => ({success: true, models: [{name: 'a'}]});
        const asking = vi.fn();
        const watching = vi.fn();
        const one = renderHook(() => useFetchModels(asking));
        const other = renderHook(() => useFetchModels(watching));

        await act(async () => {
            await one.result.current.fetchModels();
        });
        LlmService.getInstance().fetchModels = async () => ({success: false, error: 'down'});
        await act(async () => {
            await one.result.current.fetchModels();
        });

        expect(asking).toHaveBeenCalledWith('Failed to fetch models: down');
        expect(watching).not.toHaveBeenCalled();
        expect([other.result.current.models, other.result.current.reachable]).toEqual([[], false]);
    });

    it('keeps the newest answer: an older fetch that comes back last changes nothing', async () => {
        let answerOld: (() => void) | undefined;

        LlmService.getInstance().fetchModels = () => new Promise((resolve) => {
            answerOld = () => resolve({success: true, models: [{name: 'old'}]});
        });
        const {result} = renderHook(() => useFetchModels());
        let first: Promise<string[] | null> = Promise.resolve(null);

        act(() => { first = result.current.fetchModels(); });
        LlmService.getInstance().fetchModels = async () => ({success: true, models: [{name: 'new'}]});
        await act(async () => {
            await result.current.fetchModels();
        });
        await act(async () => {
            answerOld!();
            await first;
        });

        expect(result.current.models).toEqual(['new']);
    });

    it('keeps the list while the same host is asked again (Settings opening), and empties it at once for a new host', async () => {
        const {result} = renderHook(() => useFetchModels());
        let answer: (() => void) | undefined;
        const pendingFetch = () => {
            LlmService.getInstance().fetchModels = () => new Promise((resolve) => {
                answer = () => resolve({success: true, models: [{name: 'b'}]});
            });
        };

        localStorage.setItem('ollamaHost', 'http://host-a:11434');
        LlmService.getInstance().fetchModels = async () => ({success: true, models: [{name: 'a'}]});
        await act(async () => {
            await result.current.fetchModels();
        });

        pendingFetch();
        act(() => { void result.current.fetchModels(); });
        expect([result.current.models, result.current.reachable]).toEqual([['a'], true]);
        await act(async () => { answer!(); });

        localStorage.setItem('ollamaHost', 'http://host-b:11434');
        pendingFetch();
        act(() => { void result.current.fetchModels(); });
        expect([result.current.models, result.current.reachable]).toEqual([[], false]);
        await act(async () => { answer!(); });
        expect(result.current.models).toEqual(['b']);

        localStorage.removeItem('ollamaHost');
    });

    it('is loading only while no list is known: a known list refreshing stays shown, not a spinner', async () => {
        let answer: (() => void) | undefined;

        LlmService.getInstance().fetchModels = () => new Promise((resolve) => {
            answer = () => resolve({success: true, models: [{name: 'a'}]});
        });
        const {result} = renderHook(() => useFetchModels());

        act(() => { void result.current.fetchModels(); });
        expect(result.current.isFetchingModels).toBe(true);
        await act(async () => { answer!(); });
        expect(result.current.isFetchingModels).toBe(false);

        act(() => { void result.current.fetchModels(); });
        expect([result.current.isFetchingModels, result.current.models]).toEqual([false, ['a']]);
        await act(async () => { answer!(); });
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
