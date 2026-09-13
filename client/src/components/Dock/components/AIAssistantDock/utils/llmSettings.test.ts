/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {
    CONTEXT_WINDOW_MIN,
    DEFAULT_CONTEXT_WINDOW,
    DEFAULT_TEMPERATURE,
    LlmSettingsMap,
    fromDraft,
    getModelSettings,
    readLlmSettingsMap,
    toDraft,
    withModelSettings
} from './llmSettings';
import {isCloudModel, readModelContextMap, resolveContextLimit, withModelContext} from './modelContext';
import {writeJsonRecord} from './storage';

describe('getModelSettings', () => {
    it('returns an empty object for a model with nothing stored', () => {
        expect(getModelSettings({}, 'qwen3:8b')).toEqual({});
    });

    it('does not invent a temperature for a model that never overrode one', () => {
        // The regression that matters: merging defaults here would read as "overridden to 0.8"
        // and start sending a temperature on every request.
        const settings = getModelSettings({'qwen3:8b': {think: true}}, 'qwen3:8b');

        expect(settings.temperature).toBeUndefined();
        expect(settings.contextWindow).toBeUndefined();
        expect(settings.think).toBe(true);
    });
});

describe('withModelSettings', () => {
    it('does not mutate the input map and preserves other models', () => {
        const map: LlmSettingsMap = {'a:1': {think: true}};
        const next = withModelSettings(map, 'b:2', {temperature: 1.2});

        expect(map).toEqual({'a:1': {think: true}});
        expect(next).toEqual({'a:1': {think: true}, 'b:2': {temperature: 1.2}});
    });

    it('deletes the model entry when nothing is set, leaving no residue', () => {
        const map: LlmSettingsMap = {'a:1': {think: true}, 'b:2': {temperature: 1.2}};

        expect(withModelSettings(map, 'a:1', {})).toEqual({'b:2': {temperature: 1.2}});
    });
});

describe('readLlmSettingsMap', () => {
    it.each([
        ['undefined', undefined],
        ['an empty string', ''],
        ['invalid JSON', 'not json'],
        ['a JSON null', 'null'],
        ['a JSON array', '[]'],
        ['a JSON number', '5'],
    ])('returns an empty map for %s without throwing', (_label, raw) => {
        expect(readLlmSettingsMap(raw as string | undefined)).toEqual({});
    });

    it('drops entries that are not objects', () => {
        expect(readLlmSettingsMap('{"a:1":5,"b:2":{"think":true}}')).toEqual({'b:2': {think: true}});
    });

    it('drops wrong-typed fields but keeps the rest of the entry', () => {
        expect(readLlmSettingsMap('{"a:1":{"think":"yes","temperature":0.5}}')).toEqual({'a:1': {temperature: 0.5}});
    });

    it('clamps an out-of-range temperature rather than passing it through', () => {
        expect(readLlmSettingsMap('{"a:1":{"temperature":99}}')).toEqual({'a:1': {temperature: 2}});
        expect(readLlmSettingsMap('{"a:1":{"temperature":-5}}')).toEqual({'a:1': {temperature: 0}});
    });

    it('floors a too-small context window at the minimum', () => {
        expect(readLlmSettingsMap('{"a:1":{"contextWindow":1}}')).toEqual({'a:1': {contextWindow: CONTEXT_WINDOW_MIN}});
    });

    it('round-trips through writeJsonRecord', () => {
        const map: LlmSettingsMap = {'a:1': {think: true, temperature: 1.5}, 'b:2': {contextWindow: 8192}};

        expect(readLlmSettingsMap(writeJsonRecord(map))).toEqual(map);
    });
});

describe('toDraft / fromDraft', () => {
    it('gives an unset model the slider defaults with both toggles off', () => {
        expect(toDraft({})).toEqual({
            think: false,
            thinkLevel: 'default',
            temperatureEnabled: false,
            temperature: DEFAULT_TEMPERATURE,
            contextWindowEnabled: false,
            contextWindow: DEFAULT_CONTEXT_WINDOW,
        });
    });

    it('marks a field enabled precisely when it is present', () => {
        const draft = toDraft({temperature: 1.4});

        expect(draft.temperatureEnabled).toBe(true);
        expect(draft.temperature).toBe(1.4);
        expect(draft.contextWindowEnabled).toBe(false);
    });

    it('omits a disabled field entirely rather than writing its value', () => {
        const draft = {...toDraft({}), temperature: 1.9, contextWindow: 16384};

        expect(fromDraft(draft)).toEqual({});
    });

    it('round-trips a fully-set settings object', () => {
        const settings = {think: true, temperature: 1.1, contextWindow: 8192};

        expect(fromDraft(toDraft(settings))).toEqual(settings);
    });
});

describe('readModelContextMap', () => {
    it('keeps null as a present key, distinct from an absent one', () => {
        const map = readModelContextMap('{"a:1":null}');

        expect('a:1' in map).toBe(true);
        expect(map['a:1']).toBeNull();
        expect('b:2' in map).toBe(false);
    });

    it('drops values that are neither null nor a positive number', () => {
        expect(readModelContextMap('{"a:1":"4096","b:2":0,"c:3":4096}')).toEqual({'c:3': 4096});
    });

    it('records a null without dropping existing entries', () => {
        expect(withModelContext({'a:1': 4096}, 'b:2', null)).toEqual({'a:1': 4096, 'b:2': null});
    });
});

describe('isCloudModel', () => {
    it.each([
        ['gpt-oss:120b-cloud', true],
        ['qwen3-coder:480b-cloud', true],
        ['deepseek-v3.1:671b-cloud', true],
        ['gpt-oss:120b', false],
        ['qwen3:8b', false],
        ['cloud-llama:7b', false],
    ])('classifies %s', (model, expected) => {
        expect(isCloudModel(model as string)).toBe(expected);
    });
});

describe('resolveContextLimit', () => {
    it('assumes the Ollama default when nothing is overridden', () => {
        expect(resolveContextLimit('qwen3:8b', {}, 40960))
            .toEqual({limit: DEFAULT_CONTEXT_WINDOW, source: 'assumedDefault'});
    });

    it('uses the override for a local model when one is set', () => {
        expect(resolveContextLimit('qwen3:8b', {contextWindow: 8192}, 40960))
            .toEqual({limit: 8192, source: 'override'});
    });

    it("uses a cloud model's maximum, since Ollama Cloud always serves the full window", () => {
        expect(resolveContextLimit('gpt-oss:120b-cloud', {}, 262144))
            .toEqual({limit: 262144, source: 'cloudMax'});
    });

    it('ignores a stale override on a cloud model rather than measuring against a fiction', () => {
        // The regression this ordering exists for: num_ctx is a no-op on Cloud, so honouring a
        // leftover 8192 here would show "over limit" on a 262k window while nothing is wrong.
        expect(resolveContextLimit('gpt-oss:120b-cloud', {contextWindow: 8192}, 262144))
            .toEqual({limit: 262144, source: 'cloudMax'});
    });

    it('reports an unknown limit rather than a default when a cloud model reports no maximum', () => {
        expect(resolveContextLimit('gpt-oss:120b-cloud', {}, null))
            .toEqual({limit: null, source: 'cloudMax'});
        expect(resolveContextLimit('gpt-oss:120b-cloud', {}, undefined))
            .toEqual({limit: null, source: 'cloudMax'});
    });
});

describe('think levels', () => {
    it('treats a level as thinking-on, keeping the level selected', () => {
        const draft = toDraft({think: 'low'});

        expect(draft.think).toBe(true);
        expect(draft.thinkLevel).toBe('low');
    });

    it('treats a plain true as thinking-on at the model default', () => {
        const draft = toDraft({think: true});

        expect(draft.think).toBe(true);
        expect(draft.thinkLevel).toBe('default');
    });

    it('treats an explicit false the same as unset', () => {
        expect(toDraft({think: false}).think).toBe(false);
        expect(toDraft({}).think).toBe(false);
    });

    it('writes a level rather than a boolean when one is picked', () => {
        expect(fromDraft({...toDraft({}), think: true, thinkLevel: 'high'})).toEqual({think: 'high'});
    });

    it('writes a plain true for the model default', () => {
        expect(fromDraft({...toDraft({}), think: true, thinkLevel: 'default'})).toEqual({think: true});
    });

    it('drops the level entirely when thinking is off', () => {
        expect(fromDraft({...toDraft({}), think: false, thinkLevel: 'high'})).toEqual({});
    });

    it('round-trips every level', () => {
        for (const level of ['low', 'medium', 'high'] as const) {
            expect(fromDraft(toDraft({think: level}))).toEqual({think: level});
        }
    });

    it('accepts a stored level and rejects a bogus one', () => {
        expect(readLlmSettingsMap('{"a:1":{"think":"high"}}')).toEqual({'a:1': {think: 'high'}});
        expect(readLlmSettingsMap('{"a:1":{"think":"turbo"}}')).toEqual({'a:1': {}});
    });
});
