/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {useLlmSettings} from './useLlmSettings';
import {useGlobalConfig} from '../../../../../stores/globalConfig';
import {LLM_SETTINGS_STORAGE_KEY} from '../utils/llmSettings';
import {MODEL_CONTEXT_STORAGE_KEY} from '../utils/modelContext';

const PREFIX = 'agentic-signal.globalData.';

/*
 * Seeds BOTH sides: the writers read localStorage (so a merge can see another tab's work) while
 * the hook renders from the store's in-memory mirror. The store is a module singleton shared by
 * every test file in the same worker, so it is reset in beforeEach too.
 */
const seedStore = (globalData: Record<string, string | undefined> = {}) => {
    useGlobalConfig.setState({globalData});

    for (const [key, value] of Object.entries(globalData)) {
        if (value !== undefined) localStorage.setItem(`${PREFIX}${key}`, value);
    }
};

beforeEach(() => {
    localStorage.clear();
    seedStore();
});

describe('useLlmSettings', () => {
    it('starts empty and persists saved settings under the prefixed storage key', () => {
        const {result} = renderHook(() => useLlmSettings());

        expect(result.current.settingsMap).toEqual({});

        act(() => { result.current.saveModelSettings('qwen3:8b', {think: true, temperature: 1.2}); });

        expect(result.current.settingsMap).toEqual({'qwen3:8b': {think: true, temperature: 1.2}});
        expect(localStorage.getItem(`agentic-signal.globalData.${LLM_SETTINGS_STORAGE_KEY}`))
            .toBe('{"qwen3:8b":{"think":true,"temperature":1.2}}');
    });

    it('does not clobber another model when saving', () => {
        const {result} = renderHook(() => useLlmSettings());

        act(() => { result.current.saveModelSettings('a:1', {think: true}); });
        act(() => { result.current.saveModelSettings('b:2', {temperature: 0.4}); });

        expect(result.current.settingsMap).toEqual({'a:1': {think: true}, 'b:2': {temperature: 0.4}});
    });

    it('ignores a save for an empty model name, so no "" entry can be created', () => {
        const {result} = renderHook(() => useLlmSettings());

        act(() => { result.current.saveModelSettings('', {think: true}); });

        expect(result.current.settingsMap).toEqual({});
    });

    it('yields an empty map for a corrupt stored value instead of throwing', () => {
        seedStore({[LLM_SETTINGS_STORAGE_KEY]: 'not json', [MODEL_CONTEXT_STORAGE_KEY]: '[]'});

        const {result} = renderHook(() => useLlmSettings());

        expect(result.current.settingsMap).toEqual({});
        expect(result.current.contextMap).toEqual({});
    });

    it('records a null context length as a present key — the invariant the dialog effect relies on', () => {
        const {result} = renderHook(() => useLlmSettings());

        act(() => { result.current.rememberModelContextLength('a:1', null); });

        expect('a:1' in result.current.contextMap).toBe(true);
        expect(result.current.contextMap['a:1']).toBeNull();
    });

    it('refuses to overwrite an already-cached context length', () => {
        const {result} = renderHook(() => useLlmSettings());

        act(() => { result.current.rememberModelContextLength('a:1', 4096); });
        act(() => { result.current.rememberModelContextLength('a:1', 8192); });

        expect(result.current.contextMap['a:1']).toBe(4096);
    });

    it('keeps the two maps in separate storage keys', () => {
        const {result} = renderHook(() => useLlmSettings());

        act(() => { result.current.saveModelSettings('a:1', {think: true}); });
        act(() => { result.current.rememberModelContextLength('a:1', 4096); });

        expect(result.current.settingsMap).toEqual({'a:1': {think: true}});
        expect(result.current.contextMap).toEqual({'a:1': 4096});
    });
});

describe('useLlmSettings across two tabs', () => {
    it('merges into what storage holds, not the stale in-memory snapshot', () => {
        /*
         * The lost update: this tab's mirror is from page load, while another tab has since
         * written `b:2`. Merging into the mirror would serialise a map without `b:2` and wipe
         * it. Reading storage at write time is what preserves it.
         */
        localStorage.setItem(`${PREFIX}${LLM_SETTINGS_STORAGE_KEY}`, '{"b:2":{"temperature":1.5}}');
        useGlobalConfig.setState({globalData: {[LLM_SETTINGS_STORAGE_KEY]: '{}'}});

        const {result} = renderHook(() => useLlmSettings());

        act(() => { result.current.saveModelSettings('a:1', {think: true}); });

        const persisted = JSON.parse(localStorage.getItem(`${PREFIX}${LLM_SETTINGS_STORAGE_KEY}`)!);

        expect(persisted).toEqual({'b:2': {temperature: 1.5}, 'a:1': {think: true}});
    });

    it('does not resurrect a context length another tab removed', () => {
        localStorage.setItem(`${PREFIX}${MODEL_CONTEXT_STORAGE_KEY}`, '{}');
        useGlobalConfig.setState({globalData: {[MODEL_CONTEXT_STORAGE_KEY]: '{"a:1":4096}'}});

        const {result} = renderHook(() => useLlmSettings());

        // The stale mirror still lists a:1, but storage does not — so this must write, not skip.
        act(() => { result.current.rememberModelContextLength('a:1', 8192); });

        const persisted = JSON.parse(localStorage.getItem(`${PREFIX}${MODEL_CONTEXT_STORAGE_KEY}`)!);

        expect(persisted).toEqual({'a:1': 8192});
    });
});

describe('globalConfig storage listener', () => {
    it("picks up another tab's write", () => {
        const {result} = renderHook(() => useLlmSettings());

        act(() => {
            window.dispatchEvent(new StorageEvent('storage', {
                key: `${PREFIX}${LLM_SETTINGS_STORAGE_KEY}`,
                newValue: '{"a:1":{"think":true}}',
            }));
        });

        expect(result.current.settingsMap).toEqual({'a:1': {think: true}});
    });

    it('treats a null newValue as a removal', () => {
        seedStore({[LLM_SETTINGS_STORAGE_KEY]: '{"a:1":{"think":true}}'});

        const {result} = renderHook(() => useLlmSettings());

        expect(result.current.settingsMap).toEqual({'a:1': {think: true}});

        act(() => {
            window.dispatchEvent(new StorageEvent('storage', {
                key: `${PREFIX}${LLM_SETTINGS_STORAGE_KEY}`,
                newValue: null,
            }));
        });

        expect(result.current.settingsMap).toEqual({});
    });

    it('ignores keys outside the global-config namespace', () => {
        seedStore({[LLM_SETTINGS_STORAGE_KEY]: '{"a:1":{"think":true}}'});

        const {result} = renderHook(() => useLlmSettings());

        act(() => {
            window.dispatchEvent(new StorageEvent('storage', {key: 'ollamaHost', newValue: 'http://x'}));
        });

        expect(result.current.settingsMap).toEqual({'a:1': {think: true}});
    });
});
