/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useCallback} from "react";
import {type NodeProps} from "@xyflow/react";
import {AppNode, assertIsEnhancedNodeData, assertIsToolNodeData} from "../../../types/workflow";
import {BaseNode} from "../BaseNode";
import {useState} from "react";
import {BaseDialog} from "../../BaseDialog";
import {CodeEditor} from "../../CodeEditor";
import {LogsDialog} from "../../LogsDialog";
import {AI_TOOL_PORT_COLOR, TaskNodeIcons, TOOL_PORT_ID} from "../../../constants";
import {toolRegistry} from "./tools";
import {MenuItem, Select, FormControl, InputLabel} from "@mui/material";
import {UserConfigFields} from "./UserConfigFields";

export function ToolNode ({data, id, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsToolNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {title, toolSubtype, userConfig, handler, onConfigChange} = data;
    const selectedTool = toolRegistry.find(t => t.toolSubtype === toolSubtype);

    useEffect(() => {
        if (selectedTool && !handler) {
            const requiredKeys = Object.keys(selectedTool.userConfigSchema || {});
            const missingKeys = requiredKeys.filter(k => !userConfig?.[k]);

            if (missingKeys.length > 0) {
                const missingLabels = missingKeys.map(key => {
                    const configSchema = selectedTool.userConfigSchema || {};
                    const schema = (configSchema as any)[key];

                    return schema?.description || key;
                });
                const errorMessage = `⚠️Missing required configuration:\n- "${missingLabels.join('"\n- "')}"`;

                setError(errorMessage);
            } else if (requiredKeys.length === 0 && selectedTool.handlerFactory) {
                const handler = selectedTool.handlerFactory(userConfig || {});

                onConfigChange(id, {handler});

                setError(null);
            } else if (selectedTool.handlerFactory) {
                const handler = selectedTool.handlerFactory(userConfig || {});

                onConfigChange(id, {handler});

                setError(null);
            }
        }
    }, [selectedTool, handler, userConfig, onConfigChange, id]);

    const hasMissingConfig =
        !toolSubtype ||
        (selectedTool?.userConfigSchema &&
            Object.entries(selectedTool.userConfigSchema).some(([key]) => {
                return !userConfig?.[key];
            })
        ) || false;

    const handleUserConfigChange = useCallback((key: string, value: string | number) => {
        const newUserConfig = {...(userConfig || {}), [key]: value};

        let handler: ((params: any) => Promise<any>) | undefined = undefined;

        if (selectedTool?.handlerFactory) {
            const requiredKeys = Object.keys(selectedTool.userConfigSchema || {});
            const missingKeys = requiredKeys.filter(k => !newUserConfig[k]);

            if (missingKeys.length > 0) {
                const missingLabels = missingKeys.map(key => {
                    const configSchema = selectedTool.userConfigSchema || {};
                    const schema = (configSchema as any)[key];

                    return schema?.description || key;
                });
                const errorMessage = `⚠️Missing required configuration:\n- "${missingLabels.join('"\n- "')}"`;

                setError(errorMessage);
            } else {
                handler = selectedTool.handlerFactory(newUserConfig as any);

                setError(null);
            }
        }

        onConfigChange(id, {
            userConfig: newUserConfig,
            handler
        });
    }, [id, onConfigChange, selectedTool, userConfig]);

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={selectedTool?.icon || TaskNodeIcons[type]}
                ports={{
                    output: {
                        isValidConnection: ({targetHandle}) => targetHandle === TOOL_PORT_ID,
                        color: AI_TOOL_PORT_COLOR
                    }
                }}
                title={selectedTool?.title || title}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={selectedTool?.title || title}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={selectedTool?.title || title}
            >
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

                                if (!tool.userConfigSchema || Object.keys(tool.userConfigSchema).length === 0) {
                                    handler = tool.handlerFactory({});
                                }

                                onConfigChange(id, {
                                    toolSubtype: tool.toolSubtype,
                                    toolSchema: tool.toolSchema,
                                    title: tool.title,
                                    userConfig: {},
                                    handler
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
                {selectedTool?.userConfigSchema && (
                    <UserConfigFields
                        userConfigSchema={selectedTool.userConfigSchema}
                        userConfig={userConfig || {}}
                        onConfigChange={handleUserConfigChange}
                    />
                )}
                <CodeEditor
                    mode="json"
                    value={JSON.stringify(selectedTool?.toolSchema || {}, null, 4)}
                    readOnly={true}
                    showLineNumbers={true}
                />
            </BaseDialog>
        </>
    );
}