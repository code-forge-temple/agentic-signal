/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import {Handle, Position, useReactFlow, type NodeProps} from "@xyflow/react";
import {assertIsToolNodeData, ToolNodeData} from "./types/workflow";
import {MonitoredNode} from "../MonitoredNode";
import {BaseDialog} from "../../BaseDialog";
import {CodeEditor} from "../../CodeEditor";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../constants";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import {UserConfigFields} from "./UserConfigFields";
import {FieldsetGroup} from "../../FieldsetGroup";
import {AppNode} from "../workflow.gen";
import {Icon} from "./constants";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {toolRegistry} from "./tools/toolRegistry.gen";
import {getDefaultUserConfigValues} from "../../../types/tool.types";
import {NODE_TYPE as LLM_NODE_TYPE} from "../LlmProcessNode/constants";
import {RenderConfigProps, ToolDefinition} from "./tools/types";
import {hasSettings} from "./toolConfig";
import {useToolRuntime} from "./useToolRuntime";


/** The node's port: it connects only to an LLM Process node's tool port. */
function ToolPort () {
    const {getNode} = useReactFlow();

    return (
        <Handle
            type="source"
            id={NODE_PORT_IDS.TOOL}
            position={Position.Right}
            style={{backgroundColor: NODE_PORT_COLORS.TOOL}}
            isValidConnection={({target, targetHandle}) => getNode(target)?.type === LLM_NODE_TYPE && targetHandle === NODE_PORT_IDS.TOOL}
        />
    );
}

type ToolSettingsProps = {
    tool: ToolDefinition;
    userConfig: ToolNodeData["userConfig"];
    onConfigChange: RenderConfigProps["onConfigChange"];
};

/** The tool's settings, defaults filled in: in its own fields when it has them, else a field per setting. */
function ToolSettings ({tool, userConfig, onConfigChange}: ToolSettingsProps) {
    const shownConfig = {...getDefaultUserConfigValues(tool.userConfigSchema), ...(userConfig || {})};

    return (
        <FieldsetGroup title="Tool Configuration" style={{paddingBottom: 0}}>
            {tool.renderConfig
                ? tool.renderConfig({userConfig: shownConfig, onConfigChange})
                : <UserConfigFields userConfigSchema={tool.userConfigSchema} userConfig={shownConfig} onConfigChange={onConfigChange} />
            }
        </FieldsetGroup>
    );
}

type ToolSettingsBodyProps = {
    toolSubtype: string;
    selectedTool: ToolDefinition | undefined;
    userConfig: ToolNodeData["userConfig"];
    onToolPick: (toolSubtype: string) => void;
    onUserConfigChange: RenderConfigProps["onConfigChange"];
};

/** The settings dialog's content: the tool to use, its settings, and its schema. */
function ToolSettingsBody ({toolSubtype, selectedTool, userConfig, onToolPick, onUserConfigChange}: ToolSettingsBodyProps) {
    return (
        <div style={{display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 0, flex: 1}}>
            <FormControl fullWidth sx={{mb: 2}}>
                <InputLabel id="tool-select-label">Tool</InputLabel>
                <Select
                    labelId="tool-select-label"
                    value={toolSubtype}
                    label="Tool"
                    onChange={e => onToolPick(e.target.value)}
                >
                    {toolRegistry.map(tool => (
                        <MenuItem key={tool.toolSubtype} value={tool.toolSubtype}>
                            {tool.title}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {selectedTool && hasSettings(selectedTool) && (
                <ToolSettings tool={selectedTool} userConfig={userConfig} onConfigChange={onUserConfigChange} />
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
    );
}

export function ToolNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsToolNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const {title, toolSubtype, userConfig} = data;
    const selectedTool = toolRegistry.find(t => t.toolSubtype === toolSubtype);
    const {error, hasMissingConfig, handleUserConfigChange, pickTool} = useToolRuntime({id, selectedTool, data});
    const shownTitle = selectedTool?.title || title;

    const handleToolPick = (pickedSubtype: string) => {
        const tool = toolRegistry.find(t => t.toolSubtype === pickedSubtype);

        if (tool) pickTool(tool);
    };

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={selectedTool?.icon || Icon}
                ports={{}}
                extraPorts={<ToolPort />}
                title={shownTitle}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={shownTitle}
            >
                <ToolSettingsBody
                    toolSubtype={toolSubtype}
                    selectedTool={selectedTool}
                    userConfig={userConfig}
                    onToolPick={handleToolPick}
                    onUserConfigChange={handleUserConfigChange}
                />
            </BaseDialog>
        </>
    );
}
