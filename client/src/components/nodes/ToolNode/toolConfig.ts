/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {getDefaultUserConfigValues} from "../../../types/ollama.types";
import {ToolDefinition} from "./tools/types";
import {globalToolProp} from "./tools/utils/utils";


type GlobalData = Record<string, string | undefined>;
type ToolConfig = Record<string, unknown> | undefined;

// A config field's value: the one shared under `<toolSubtype>.<field>` (saved in Settings → Credentials, or typed
// into any node of the tool this session) first, as the tools' settings fields show it; the node's own copy only
// when nothing is shared. An empty shared value counts too: it was cleared, for every node.
function configValue (globalData: GlobalData, toolSubtype: string, config: ToolConfig, key: string): unknown {
    return globalData[globalToolProp(toolSubtype, key)] ?? config?.[key];
}

/** The tool's required settings that have no value: neither a shared one nor the node's own. */
export function missingConfigKeys (tool: ToolDefinition, globalData: GlobalData, config: ToolConfig): string[] {
    const schema = tool.userConfigSchema || {};

    return Object.keys(schema).filter(key => schema[key]?.required && !configValue(globalData, tool.toolSubtype, config, key));
}

/** The node's error for missing settings, each named by its description (or its key). */
export function missingConfigError (tool: ToolDefinition, missingKeys: string[]): string {
    const schema = tool.userConfigSchema || {};
    const labels = missingKeys.map(key => schema[key]?.description || key);

    return `⚠️Missing required configuration:\n- "${labels.join('"\n- "')}"`;
}

/** The handler and cleanup the tool runs with: the node's settings, shared values first, and the browser to use. */
export function toolRuntime (tool: ToolDefinition, globalData: GlobalData, config: ToolConfig, browserPath: string | undefined) {
    const effectiveConfig = Object.keys(tool.userConfigSchema || {}).reduce((configWithFallbacks, configKey) => {
        configWithFallbacks[configKey] = configValue(globalData, tool.toolSubtype, config, configKey);

        return configWithFallbacks;
    }, {...(config || {})} as Record<string, unknown>);

    return {
        handler: tool.handlerFactory({...effectiveConfig, browserPath}),
        cleanup: tool.runtimeCleanup?.({...effectiveConfig, browserPath}),
    };
}

/** Whether the tool has settings to show (and to set before it gets a handler). */
export const hasSettings = (tool: ToolDefinition) => !!tool.userConfigSchema && Object.keys(tool.userConfigSchema).length > 0;

/**
 * The node's new data when `tool` is picked: the tool's defaults, its secrets added to the node's own list of fields
 * removed on save, and a handler right away when the tool has no settings (one with settings gets it once they're set).
 */
export function pickedTool (tool: ToolDefinition, toSanitize: string[]) {
    const withSettings = hasSettings(tool);

    return {
        toolSubtype: tool.toolSubtype,
        toolSchema: tool.toolSchema,
        title: tool.title,
        userConfig: getDefaultUserConfigValues(tool.userConfigSchema || {}),
        handler: withSettings ? undefined : tool.handlerFactory({}),
        cleanup: withSettings ? undefined : tool.runtimeCleanup?.({}),
        toSanitize: [...toSanitize, ...tool.toSanitize],
    };
}
