/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useChatModel} from './useChatModel';
import {OllamaService} from '../../../../../services/ollamaService';
import {useGlobalConfig} from '../../../../../stores/globalConfig';
import {refreshOllamaModels, useOllamaModels} from '../../../../../stores/ollamaModels';


const STORAGE_KEY = 'agentic-signal.globalData.selectedModel';

// Both sides: the store renders from its in-memory mirror, and a persisted write goes to localStorage.
const saveModel = (model: string) => {
    useGlobalConfig.setState({globalData: {selectedModel: model}});
    localStorage.setItem(STORAGE_KEY, model);
};

const ollamaLists = (...names: string[]) => {
    const fetchModels = vi.fn(async () => ({success: true as const, models: names.map(name => ({name}))}));

    OllamaService.getInstance().fetchModels = fetchModels;

    return fetchModels;
};

// Lets the model fetch and what follows it finish.
const settle = () => act(async () => {});

beforeEach(() => {
    OllamaService.reloadInstance();
    localStorage.clear();
    useGlobalConfig.setState({globalData: {}});
    useOllamaModels.setState({models: [], reachable: false, isFetching: false});
});

afterEach(() => {
    cleanup();
});

describe('useChatModel', () => {
    it('selects the saved model while Ollama still has it', async () => {
        saveModel('a:1');
        ollamaLists('a:1', 'b:2');

        const {result} = renderHook(() => useChatModel());

        await waitFor(() => expect(result.current.selectedModel).toBe('a:1'));
        expect(result.current.models).toEqual(['a:1', 'b:2']);
    });

    it('selects none and clears the saved choice once Ollama no longer has the model', async () => {
        saveModel('gone:1');
        ollamaLists('b:2');

        const {result} = renderHook(() => useChatModel());

        await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());
        expect(result.current.selectedModel).toBe('');
        expect(useGlobalConfig.getState().globalData.selectedModel).toBe('');
    });

    it('keeps the saved choice for next time while Ollama cannot be reached', async () => {
        saveModel('a:1');

        const fetchModels = vi.fn(async () => ({success: false as const, error: 'daemon not running'}));

        OllamaService.getInstance().fetchModels = fetchModels;

        const {result} = renderHook(() => useChatModel());

        await waitFor(() => expect(fetchModels).toHaveBeenCalled());
        await settle();

        expect(result.current.selectedModel).toBe('');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('a:1');
    });

    it('selects a model chosen in the chat and saves it for next time', async () => {
        ollamaLists('a:1', 'b:2');

        const {result} = renderHook(() => useChatModel());

        await settle();
        act(() => result.current.chooseModel('b:2'));
        await settle();

        expect(result.current.selectedModel).toBe('b:2');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('b:2');
    });

    it('shows a model pulled elsewhere, and lets go of one deleted elsewhere, saved choice too (the list is shared)', async () => {
        saveModel('m1');
        ollamaLists('m1');
        const {result} = renderHook(() => useChatModel());

        await settle();
        expect(result.current.selectedModel).toBe('m1');

        ollamaLists('m1', 'm2');
        await act(async () => { await refreshOllamaModels(); });
        expect(result.current.models).toEqual(['m1', 'm2']);
        expect(result.current.selectedModel).toBe('m1');

        ollamaLists('m2');
        await act(async () => { await refreshOllamaModels(); });
        await settle();
        expect(result.current.selectedModel).toBe('');
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('keeps its model while the list is only forgotten for a new host, not fetched without it', async () => {
        saveModel('m1');
        ollamaLists('m1');
        const {result} = renderHook(() => useChatModel());

        await settle();
        act(() => useOllamaModels.setState({models: [], reachable: false}));
        expect(result.current.selectedModel).toBe('m1');
    });
});
