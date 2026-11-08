/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useCallback} from "react";
import {Handle, Position, useReactFlow, type NodeProps} from "@xyflow/react";
import {assertIsToolNodeData} from "./types/workflow";
import {MonitoredNode} from "../MonitoredNode";
import {useState} from "react";
import {BaseDialog} from "../../BaseDialog";
import {CodeEditor} from "../../CodeEditor";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../constants";
import {MenuItem, Select, FormControl, InputLabel} from "@mui/material";
import {UserConfigFields} from "./UserConfigFields";
import {FieldsetGroup} from "../../FieldsetGroup";
import {useSettings} from "../../../hooks/useSettings";
import {AppNode} from "../workflow.gen";
import {Icon} from "./constants";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {toolRegistry} from "./tools/toolRegistry.gen";
import {getDefaultUserConfigValues} from "../../../types/ollama.types";
import {useGlobalConfig} from "../../../stores/globalConfig";
import {globalToolProp} from "./tools/utils/utils";
import {NODE_TYPE as LLM_NODE_TYPE} from "../LlmProcessNode/constants";


// A config field's value: the one shared under `<toolSubtype>.<field>` (saved in Settings → Credentials, or typed
// into any node of the tool this session) first, as the tools' settings fields show it; the node's own copy only
// when nothing is shared. An empty shared value counts too: it was cleared, for every node.
function configValue (globalData: Record<string, string | undefined>, toolSubtype: string, config: Record<string, unknown> | undefined, key: string): unknown {
    return globalData[globalToolProp(toolSubtype, key)] ?? config?.[key];
}


export function ToolNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsToolNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {title, toolSubtype, userConfig, handler, cleanup, onConfigChange, toSanitize} = data;
    const selectedTool = toolRegistry.find(t => t.toolSubtype === toolSubtype);
    const {settings} = useSettings();
    const {globalData} = useGlobalConfig();

    useEffect(() => {
        if (selectedTool) {
            const requiredKeys = Object.keys(selectedTool.userConfigSchema || {});
            const missingKeys = requiredKeys.filter(key => {
                const schema = selectedTool.userConfigSchema?.[key];

                return schema?.required && !configValue(globalData, toolSubtype, userConfig, key);
            });

            if (missingKeys.length > 0) {
                const missingLabels = missingKeys.map(key => {
                    const configSchema = selectedTool.userConfigSchema || {};
                    const schema = configSchema[key];

                    return schema?.description || key;
                });
                const errorMessage = `⚠️Missing required configuration:\n- "${missingLabels.join('"\n- "')}"`;

                setError(errorMessage);

                if (handler || cleanup) {
                    onConfigChange(id, {handler: undefined, cleanup: undefined});
                }
            } else {
                if (selectedTool.handlerFactory && (!handler || missingKeys.length === 0)) {
                    const effectiveUserConfig = Object.keys(selectedTool.userConfigSchema || {}).reduce((configWithFallbacks, configKey) => {
                        configWithFallbacks[configKey] = configValue(globalData, toolSubtype, userConfig, configKey);

                        return configWithFallbacks;
                    }, {...(userConfig || {})} as Record<string, any>);

                    const newHandler = selectedTool.handlerFactory({
                        ...effectiveUserConfig,
                        browserPath: settings.browserPath
                    });
                    const newCleanup = selectedTool.runtimeCleanup?.({
                        ...effectiveUserConfig,
                        browserPath: settings.browserPath
                    });

                    onConfigChange(id, {handler: newHandler, cleanup: newCleanup});
                }

                setError(null);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTool, userConfig, onConfigChange, id, globalData, settings.browserPath, toolSubtype]);

    const hasMissingConfig = !toolSubtype ||
        (selectedTool?.userConfigSchema && Object.entries(selectedTool.userConfigSchema).some(
            ([key, schema]) => schema.required && !configValue(globalData, toolSubtype, userConfig, key)
        ));

    const handleUserConfigChange = useCallback((key: string, value: string | number | boolean) => {
        const newUserConfig = {
            ...(userConfig || {}),
            [key]: value,
        };

        let handler: ((params: any) => Promise<any>) | undefined = undefined;
        let cleanup: ((sessionId: string) => Promise<void>) | undefined = undefined;

        if (selectedTool?.handlerFactory) {
            const requiredKeys = Object.keys(selectedTool.userConfigSchema || {});
            const missingKeys = requiredKeys.filter(key => {
                const schema = selectedTool.userConfigSchema?.[key];

                return schema?.required && !configValue(globalData, toolSubtype, userConfig, key);
            });

            if (missingKeys.length > 0) {
                const missingLabels = missingKeys.map(key => {
                    const configSchema = selectedTool.userConfigSchema || {};
                    const schema = configSchema[key];

                    return schema?.description || key;
                });
                const errorMessage = `⚠️Missing required configuration:\n- "${missingLabels.join('"\n- "')}"`;

                setError(errorMessage);
            } else {
                const effectiveNewUserConfig = Object.keys(selectedTool.userConfigSchema || {}).reduce((configWithFallbacks, configKey) => {
                    configWithFallbacks[configKey] = configValue(globalData, toolSubtype, newUserConfig, configKey);

                    return configWithFallbacks;
                }, {...newUserConfig} as Record<string, any>);

                handler = selectedTool.handlerFactory({
                    ...effectiveNewUserConfig,
                    browserPath: settings.browserPath
                });
                cleanup = selectedTool.runtimeCleanup?.({
                    ...effectiveNewUserConfig,
                    browserPath: settings.browserPath
                });

                setError(null);
            }
        }

        onConfigChange(id, {
            userConfig: newUserConfig,
            handler,
            cleanup
        });
    }, [globalData, id, onConfigChange, selectedTool, settings.browserPath, toolSubtype, userConfig]);

    const {getNode} = useReactFlow();


    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={selectedTool?.icon || Icon}
                ports={{}}
                extraPorts={
                    <Handle
                        type="source"
                        id={NODE_PORT_IDS.TOOL}
                        position={Position.Right}
                        style={{backgroundColor: NODE_PORT_COLORS.TOOL}}
                        isValidConnection={({target, targetHandle}) => {
                            const targetNode = getNode(target);

                            if (!targetNode || targetNode.type !== LLM_NODE_TYPE) return false;

                            if (targetHandle !== NODE_PORT_IDS.TOOL) return false;

                            return true;
                        }}
                    />
                }
                title={selectedTool?.title || title}
                settings={{callback: () => setOpenSettings(true), highlight: !!hasMissingConfig}}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={selectedTool?.title || title}
            >
                <div style={{display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 0, flex: 1}}>
                    <FormControl fullWidth sx={{mb: 2}}>
                        <InputLabel id="tool-select-label">Tool</InputLabel>
                        <Select
                            labelId="tool-select-label"
                            value={toolSubtype}
                            label="Tool"
                            onChange={e => {
                                const tool = toolRegistry.find(t => t.toolSubtype === e.target.value);

                                if (tool) {
                                    let handler: ((params: any) => Promise<any>) | undefined = undefined;
                                    let cleanup: ((sessionId: string) => Promise<void>) | undefined = undefined;

                                    if (!tool.userConfigSchema || Object.keys(tool.userConfigSchema).length === 0) {
                                        handler = tool.handlerFactory({});
                                        cleanup = tool.runtimeCleanup?.({});
                                    }

                                    const defaultUserConfig = getDefaultUserConfigValues(tool.userConfigSchema || {});

                                    onConfigChange(id, {
                                        toolSubtype: tool.toolSubtype,
                                        toolSchema: tool.toolSchema,
                                        title: tool.title,
                                        userConfig: defaultUserConfig,
                                        handler,
                                        cleanup,
                                        toSanitize: [...toSanitize, ...tool.toSanitize] // important to merge the the generic ToolNode toSanitize with the tool specific ones
                                    });
                                }
                            }}
                        >
                            {toolRegistry.map(tool => (
                                <MenuItem key={tool.toolSubtype} value={tool.toolSubtype}>
                                    {tool.title}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedTool?.userConfigSchema && Object.keys(selectedTool.userConfigSchema).length > 0 && (
                        <FieldsetGroup title="Tool Configuration" style={{paddingBottom: 0}}>
                            {selectedTool.renderConfig
                                ? selectedTool.renderConfig({
                                    userConfig: {...getDefaultUserConfigValues(selectedTool.userConfigSchema), ...(userConfig || {})},
                                    onConfigChange: handleUserConfigChange,
                                })
                                : (
                                    <UserConfigFields
                                        userConfigSchema={selectedTool.userConfigSchema}
                                        userConfig={{...getDefaultUserConfigValues(selectedTool.userConfigSchema), ...(userConfig || {})}}
                                        onConfigChange={handleUserConfigChange}
                                    />
                                )
                            }
                        </FieldsetGroup>
                    )}
                    {selectedTool && (
                        <FieldsetGroup title="Tool Schema" collapsible defaultCollapsed fillAvailableSpace>
                            <CodeEditor
                                mode="json"
                                value={JSON.stringify(selectedTool.toolSchema, null, 4)}
                                readOnly={true}
                                showLineNumbers={true}
                            />
                        </FieldsetGroup>
                    )}
                </div>
            </BaseDialog>
        </>
    );
}