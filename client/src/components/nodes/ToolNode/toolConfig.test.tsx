/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it, vi} from 'vitest';
import {missingConfigError, missingConfigKeys, pickedTool, toolRuntime} from './toolConfig';
import {ToolDefinition} from './tools/types';


const handler = async () => 'ok';
const cleanup = async () => {};

const tool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
    toolSubtype: 'weather',
    title: 'Weather',
    icon: <span />,
    toolSchema: {name: 'weather', description: 'Weather', parameters: {type: 'object', properties: {}}},
    userConfigSchema: {
        apiKey: {type: 'string', description: 'API key', required: true},
        city: {type: 'string', required: true},
        units: {type: 'string', default: 'metric'},
    },
    handlerFactory: vi.fn(() => handler),
    toSanitize: ['userConfig.apiKey'],
    ...overrides,
});

describe('missingConfigKeys', () => {
    it('lists the required settings with no value', () => {
        expect(missingConfigKeys(tool(), {}, {})).toEqual(['apiKey', 'city']);
        expect(missingConfigKeys(tool(), {}, {apiKey: 'k', city: 'Rome'})).toEqual([]);
        expect(missingConfigKeys(tool(), {}, undefined)).toEqual(['apiKey', 'city']);
    });

    it('counts a shared value first, an empty one as cleared', () => {
        expect(missingConfigKeys(tool(), {'weather.apiKey': 'shared'}, {city: 'Rome'})).toEqual([]);
        expect(missingConfigKeys(tool(), {'weather.apiKey': ''}, {apiKey: 'own', city: 'Rome'})).toEqual(['apiKey']);
        expect(missingConfigKeys(tool(), {'other.apiKey': 'shared'}, {city: 'Rome'})).toEqual(['apiKey']);
    });
});

describe('missingConfigError', () => {
    it('names each missing setting by its description, else its key', () => {
        expect(missingConfigError(tool(), ['apiKey', 'city'])).toBe('⚠️Missing required configuration:\n- "API key"\n- "city"');
    });
});

describe('toolRuntime', () => {
    it('builds the handler and cleanup from the settings, shared values first, with the browser to use', () => {
        const runtimeCleanup = vi.fn(() => cleanup);
        const weather = tool({runtimeCleanup});

        const runtime = toolRuntime(weather, {'weather.apiKey': 'shared'}, {apiKey: 'own', city: 'Rome', extra: 1}, 'C:/chrome.exe');
        const expected = {apiKey: 'shared', city: 'Rome', units: undefined, extra: 1, browserPath: 'C:/chrome.exe'};

        expect(runtime).toEqual({handler, cleanup});
        expect(weather.handlerFactory).toHaveBeenCalledWith(expected);
        expect(runtimeCleanup).toHaveBeenCalledWith(expected);
    });

    it('has no cleanup for a tool without one', () => {
        expect(toolRuntime(tool(), {}, undefined, undefined)).toEqual({handler, cleanup: undefined});
    });
});

describe('pickedTool', () => {
    it('sets the tool with its defaults and adds its secrets to the fields removed on save', () => {
        expect(pickedTool(tool(), ['title'])).toEqual({
            toolSubtype: 'weather',
            toolSchema: tool().toolSchema,
            title: 'Weather',
            userConfig: {units: 'metric'},
            handler: undefined,
            cleanup: undefined,
            toSanitize: ['title', 'userConfig.apiKey'],
        });
    });

    it('builds the handler right away for a tool without settings', () => {
        const runtimeCleanup = vi.fn(() => cleanup);
        const clock = tool({userConfigSchema: {}, runtimeCleanup, toSanitize: []});

        expect(pickedTool(clock, [])).toMatchObject({userConfig: {}, handler, cleanup, toSanitize: []});
        expect(clock.handlerFactory).toHaveBeenCalledWith({});
        expect(runtimeCleanup).toHaveBeenCalledWith({});
    });
});
