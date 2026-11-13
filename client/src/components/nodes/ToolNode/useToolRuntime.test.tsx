/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, renderHook} from '@testing-library/react';
import {ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useToolRuntime} from './useToolRuntime';
import {ToolDefinition} from './tools/types';
import {ToolNodeData} from './types/workflow';
import {SettingsContext} from '../../../context/SettingsContextBase';
import {useGlobalConfig} from '../../../stores/globalConfig';


const handler = async () => 'ok';

const tool = (toolSubtype: string, userConfigSchema: ToolDefinition['userConfigSchema']): ToolDefinition => ({
    toolSubtype,
    title: toolSubtype,
    icon: <span />,
    toolSchema: {name: toolSubtype, description: toolSubtype, parameters: {type: 'object', properties: {}}},
    userConfigSchema,
    handlerFactory: () => handler,
    toSanitize: [],
});

const WEATHER = tool('weather', {apiKey: {type: 'string', description: 'API key', required: true}, units: {type: 'string', default: 'metric'}});
const GMAIL = tool('gmail', {accessToken: {type: 'oauth', required: true}, maxResults: {type: 'integer', default: 5}});
const TOOLS = [WEATHER, GMAIL];

const wrapper = ({children}: {children: ReactNode}) => (
    <SettingsContext.Provider value={{settings: {ollamaHost: '', browserPath: 'C:/chrome.exe', workflowsFolder: '', checkForUpdates: false}, setSetting: () => {}}}>
        {children}
    </SettingsContext.Provider>
);

type NodeData = Pick<ToolNodeData, "toolSubtype" | "userConfig" | "handler" | "cleanup">;

/** The hook on a node whose data changes as the app's would: onConfigChange merges into it; `refresh` renders it again. */
function nodeWith (initial: NodeData) {
    let data = initial;
    const onConfigChange = vi.fn((_id: string, patch: Record<string, unknown>) => {
        data = {...data, ...patch};
    });
    const props = () => ({selectedTool: TOOLS.find(entry => entry.toolSubtype === data.toolSubtype), data: {...data, onConfigChange}});
    const hook = renderHook(({selectedTool, data: nodeData}) => useToolRuntime({id: 'n1', selectedTool, data: nodeData}), {initialProps: props(), wrapper});

    return {
        hook,
        onConfigChange,
        data: () => data,
        refresh: () => hook.rerender(props()),
    };
}

afterEach(() => {
    cleanup();
    act(() => {
        useGlobalConfig.setState({globalData: {}});
    });
});

describe('useToolRuntime', () => {
    it('drops the handler and names the missing setting while one is missing, builds it once it is there', () => {
        const node = nodeWith({toolSubtype: 'weather', userConfig: {units: 'metric'}});

        expect(node.hook.result.current.error).toBe('⚠️Missing required configuration:\n- "API key"');
        expect(node.hook.result.current.hasMissingConfig).toBe(true);
        expect(node.data().handler).toBeUndefined();

        act(() => node.hook.result.current.handleUserConfigChange('apiKey', 'KEY'));
        node.refresh();
        node.refresh();

        expect(node.hook.result.current.error).toBeNull();
        expect(node.data().handler).toBe(handler);
    });

    it('keeps two saves made before the node renders again', () => {
        const node = nodeWith({toolSubtype: 'weather', userConfig: {units: 'metric'}});

        act(() => {
            node.hook.result.current.handleUserConfigChange('apiKey', 'KEY');
            node.hook.result.current.handleUserConfigChange('units', 'imperial');
        });

        expect(node.data().userConfig).toEqual({units: 'imperial', apiKey: 'KEY'});
    });

    it('builds a save from an earlier render (a debounced field) on the settings saved since', () => {
        const node = nodeWith({toolSubtype: 'weather', userConfig: {units: 'metric'}});
        const fromEarlierRender = node.hook.result.current.handleUserConfigChange;

        act(() => node.hook.result.current.handleUserConfigChange('units', 'imperial'));
        node.refresh();
        act(() => fromEarlierRender('apiKey', 'KEY'));

        expect(node.data().userConfig).toEqual({units: 'imperial', apiKey: 'KEY'});
    });

    it('drops a late save from the tool picked before (a sign-in finishing after the switch)', () => {
        const node = nodeWith({toolSubtype: 'gmail', userConfig: {maxResults: 5}});
        const gmailSave = node.hook.result.current.handleUserConfigChange;

        act(() => node.hook.result.current.pickTool(WEATHER));
        node.refresh();
        act(() => gmailSave('accessToken', 'google-token'));

        expect(node.data().toolSubtype).toBe('weather');
        expect(node.data().userConfig).toEqual({units: 'metric'});
    });

    it('builds the saves after a pick on the picked tool\'s settings', () => {
        const node = nodeWith({toolSubtype: 'gmail', userConfig: {maxResults: 9, accessToken: 'google-token'}});

        act(() => node.hook.result.current.pickTool(WEATHER));
        node.refresh();
        act(() => node.hook.result.current.handleUserConfigChange('apiKey', 'KEY'));

        expect(node.data().userConfig).toEqual({units: 'metric', apiKey: 'KEY'});
    });

    it('builds the handler from the tool\'s shared key, and leaves it be when another tool\'s changes', () => {
        const node = nodeWith({toolSubtype: 'weather', userConfig: {units: 'metric'}});

        act(() => useGlobalConfig.getState().setGlobalData('weather.apiKey', 'SHARED'));
        node.refresh();
        expect(node.data().handler).toBe(handler);

        const calls = node.onConfigChange.mock.calls.length;

        act(() => useGlobalConfig.getState().setGlobalData('brave-search.apiKey', 'OTHER'));
        node.refresh();
        expect(node.onConfigChange.mock.calls.length).toBe(calls);
    });
});
