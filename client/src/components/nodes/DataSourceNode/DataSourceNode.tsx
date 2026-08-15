/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPE_LABELS, DATA_SOURCE_TYPES} from "./types/workflow";
import {useCallback, useState} from "react";
import {BaseNode} from "../BaseNode";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {JsonInput} from "./components/JsonInput";
import {FilesInput} from "./components/FilesInput";
import {IMAGE_FILE_EXTENSIONS, BINARY_FILE_EXTENSIONS} from "@shared/constants";
import {markdownFilePrefix, markdownImageFilePrefix} from "@shared/utils";
import {isNodeInputWithToolsPayload, NodeInputWithToolsPayload} from "../LlmProcessNode/types/input.types";
import {DataSourceToolsPayloadSchema, DATASOURCE_INPUT_JSON_SCHEMA} from "./types/input.types";
import {formatContentForDisplay, formatErrorMessage} from "../../../utils/utils";
import {CodeEditor} from "../../CodeEditor";
import {FieldsetGroup} from "../../FieldsetGroup";


const DATA_SOURCE_TYPE_LABEL = "Data Source Type";

export function DataSourceNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataSourceNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openLogs, setOpenLogs] = useState(false);
    const {title, dataSource, input, onResultUpdate, onConfigChange} = data;

    const handleRun = useCallback(() => {
        setError(null);
        onResultUpdate(id);

        runTask(async () => {
            // An upstream DataSourceNode's output is prefixed onto this node's own data — it
            // may arrive as a plain value (string/JSON) or the { payload, toolsPayload }
            // wrapper when an earlier node in the chain carries binary file attachments.
            let upstreamPayload: unknown = input;
            let upstreamToolsPayload: Array<{name: string; base64: string; mimeType: string}> = [];

            if (isNodeInputWithToolsPayload(input)) {
                // Unlike payload (intentionally open-ended), toolsPayload has a concrete shape here —
                // validate it strictly so a malformed upstream attachment fails loudly now instead of
                // silently corrupting whatever tool consumes it later in the workflow.
                const validation = DataSourceToolsPayloadSchema.safeParse(input);

                if (!validation.success) {
                    setError(formatErrorMessage("Invalid upstream file attachments", validation.error.errors));

                    onResultUpdate(id);

                    return;
                }

                upstreamPayload = validation.data.payload;
                upstreamToolsPayload = validation.data.toolsPayload;
            }

            if (dataSource.type === DATA_SOURCE_TYPES.JSON) {
                try {
                    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
                        typeof v === 'object' && v !== null && !Array.isArray(v);

                    const current = JSON.parse(dataSource.value || "{}");
                    const merged = isPlainObject(upstreamPayload) && isPlainObject(current)
                        ? {...upstreamPayload, ...current}
                        : current;

                    if (upstreamToolsPayload.length > 0) {
                        const output: NodeInputWithToolsPayload = {payload: merged, toolsPayload: upstreamToolsPayload};

                        onResultUpdate(id, output);
                    } else {
                        onResultUpdate(id, merged);
                    }
                } catch (e) {
                    setError("Invalid JSON data: " + (e instanceof Error ? e.message : String(e)));

                    onResultUpdate(id);
                }

                return;
            } else if(dataSource.type === DATA_SOURCE_TYPES.MARKDOWN_AND_FILES) {
                let mergedOutput = dataSource.value?.text || "";
                let imageCounter = 1;
                // Upstream file attachments come first — this node's own attachments (below) are appended.
                const binaryAttachments: Array<{name: string; base64: string; mimeType: string}> = [...upstreamToolsPayload];

                for (const file of dataSource.value?.files || []) {
                    const ext = file.name.split('.').pop()?.toLowerCase() || "";
                    // isToolsPayload=undefined means infer from extension (backward compat with saved workflows)
                    const isToolsPayload = file.isToolsPayload ?? BINARY_FILE_EXTENSIONS.has(ext);

                    if (isToolsPayload && file.base64) {
                        // Binary attachment: add a note the LLM can read, collect for tool use.
                        mergedOutput += `\n\n[Binary attachment: ${file.name} — available for form file-upload fields]\n\n`;
                        binaryAttachments.push({name: file.name, base64: file.base64, mimeType: file.mimeType || "application/octet-stream"});
                    } else if (isToolsPayload) {
                        // isToolsPayload=true but no base64 — skip silently (shouldn't happen with new files)
                    } else if (IMAGE_FILE_EXTENSIONS.has(ext)) {
                        mergedOutput += `\n\n${markdownImageFilePrefix(imageCounter++, file.name)}${file.content}\n\n`;
                    } else {
                        mergedOutput += `\n\n${markdownFilePrefix(file.name)}${file.content}\n\n`;
                    }
                }

                // Prefix upstream content before this node's own — chaining multiple DataSourceNodes
                // accumulates each one's text in order.
                const upstreamText = formatContentForDisplay(upstreamPayload);
                const combinedOutput = upstreamText ? `${upstreamText}\n\n${mergedOutput}` : mergedOutput;

                if (binaryAttachments.length > 0) {
                    const output: NodeInputWithToolsPayload = {payload: combinedOutput, toolsPayload: binaryAttachments};

                    onResultUpdate(id, output);
                } else {
                    onResultUpdate(id, combinedOutput);
                }
            }
        }, setIsRunning);
    }, [dataSource.type, dataSource.value, id, onResultUpdate, input]);

    useAutoRunOnInputChange({
        clearError: () => { setError(null); },
        clearOutput: () => { onResultUpdate(id); },
        runCallback: handleRun
    }, [input]);

    useTimerTrigger(input?.timerTrigger, handleRun);

    let content;

    if (dataSource.type === DATA_SOURCE_TYPES.JSON) {
        content = <JsonInput value={dataSource.value} onChange={value => onConfigChange(id, {dataSource: {...dataSource, value}})} />;
    } else if (dataSource.type === DATA_SOURCE_TYPES.MARKDOWN_AND_FILES) {
        content = <FilesInput value={dataSource.value} onChange={value => onConfigChange(id, {dataSource: {...dataSource, value}})} />;
    }

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true,
                    output: true
                }}
                extraPorts = {
                    <TimerTriggerPort />
                }
                title={title}
                run={handleRun}
                running={isRunning}
                settings={() => setOpenSettings(true)}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
            >
                <FieldsetGroup
                    title="Expected Input Format"
                    height="100%"
                    collapsible
                    defaultCollapsed
                >
                    <CodeEditor
                        mode="json"
                        value={DATASOURCE_INPUT_JSON_SCHEMA}
                        readOnly={true}
                        showLineNumbers={true}
                    />
                </FieldsetGroup>
                <FormControl fullWidth size="small" sx={{mb: 2, mt: 1}}>
                    <InputLabel id="data-source-type-label">{DATA_SOURCE_TYPE_LABEL}</InputLabel>
                    <Select
                        labelId="data-source-type-label"
                        label={DATA_SOURCE_TYPE_LABEL}
                        value={dataSource.type}
                        onChange={e => {
                            if(e.target.value === DATA_SOURCE_TYPES.JSON) {
                                onConfigChange(id, {dataSource: {type: DATA_SOURCE_TYPES.JSON, value: ""}});
                            } else if (e.target.value === DATA_SOURCE_TYPES.MARKDOWN_AND_FILES) {
                                onConfigChange(id, {dataSource: {type: DATA_SOURCE_TYPES.MARKDOWN_AND_FILES, value: {text: "", files: []}}});
                            }
                        }}
                    >
                        {
                            Object.values(DATA_SOURCE_TYPES).map(type => (
                                <MenuItem key={type} value={type}>{DATA_SOURCE_TYPE_LABELS[type]}</MenuItem>
                            ))
                        }
                    </Select>
                </FormControl>
                {content}
            </BaseDialog>
        </>
    );
}