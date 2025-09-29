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
import {toolRegistry} from "./toolRegistry";
import {MenuItem, Select, FormControl, InputLabel} from "@mui/material";
import {UserConfigFields} from "./UserConfigFields";
import {FieldsetGroup} from "../../FieldsetGroup";
import { useSettings } from "../../../hooks/useSettings";

export function ToolNode ({data, id, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsToolNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {title, toolSubtype, userConfig, handler, onConfigChange} = data;
    const selectedTool = toolRegistry.find(t => t.toolSubtype === toolSubtype);
    const {settings} = useSettings();

    useEffect(() => {
        if (selectedTool) {
            const requiredKeys = Object.keys(selectedTool.userConfigSchema || {});
            const missingKeys = requiredKeys.filter(key => {
                const schema = (selectedTool.userConfigSchema as any)?.[key];

                return schema?.required && !userConfig?.[key];
            });

            if (missingKeys.length > 0) {
                const missingLabels = missingKeys.map(key => {
                    const configSchema = selectedTool.userConfigSchema || {};
                    const schema = (configSchema as any)[key];

                    return schema?.description || key;
                });
                const errorMessage = `⚠️Missing required configuration:\n- "${missingLabels.join('"\n- "')}"`;

                setError(errorMessage);

                if (handler) {
                    onConfigChange(id, {handler: undefined});
                }
            } else {
                if (selectedTool.handlerFactory && (!handler || missingKeys.length === 0)) {
                    const newHandler = selectedTool.handlerFactory(userConfig || {});

                    onConfigChange(id, {handler: newHandler});
                }

                setError(null);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTool, userConfig, onConfigChange, id]);

    const hasMissingConfig = !toolSubtype ||
        (selectedTool?.userConfigSchema && Object.entries(selectedTool.userConfigSchema).some(
            ([key, schema]) => schema.required && !userConfig?.[key]
        ));

    const handleUserConfigChange = useCallback((key: string, value: string | number) => {
        const newUserConfig = {
            ...(userConfig || {}),
            [key]: value,
            browserPath: settings.browserPath
        };

        let handler: ((params: any) => Promise<any>) | undefined = undefined;

        if (selectedTool?.handlerFactory) {
            const requiredKeys = Object.keys(selectedTool.userConfigSchema || {});
            const missingKeys = requiredKeys.filter(key => {
                const schema = (selectedTool.userConfigSchema as any)?.[key];

                return schema?.required && !userConfig?.[key];
            });

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
                settings={{callback: () => setOpenSettings(true), highlight: !!hasMissingConfig}}
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
                {selectedTool?.userConfigSchema && Object.keys(selectedTool.userConfigSchema).length > 0 && (
                    <FieldsetGroup title="Tool Configuration">
                        <UserConfigFields
                            userConfigSchema={selectedTool.userConfigSchema}
                            userConfig={userConfig || {}}
                            onConfigChange={handleUserConfigChange}
                        />
                    </FieldsetGroup>
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