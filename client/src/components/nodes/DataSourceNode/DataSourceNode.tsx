/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPE_LABELS, DATA_SOURCE_TYPES} from "./types/workflow";
import {AttachedFile} from "@shared/types.gen";
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
import {CodeEditor} from "../../CodeEditor";
import {FieldsetGroup} from "../../FieldsetGroup";
import {DATASOURCE_INPUT_JSON_SCHEMA} from "./types/input.types";


const DATA_SOURCE_TYPE_LABEL = "Data Source Type";
const toArray = (x: unknown): unknown[] => x === undefined ? [] : (Array.isArray(x) ? x : [x]);

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
            const up = input?.payload;
            const upTools = input?.toolsPayload;
            const upIsString = typeof up === 'string';

            if (dataSource.type === DATA_SOURCE_TYPES.JSON) {
                try {
                    const own = JSON.parse(dataSource.value || "{}");
                    // Upstream and own are kept as distinct array elements rather than merged —
                    // an object-spread merge would silently drop upstream keys on collision.
                    // JSON mode never contributes its own new tools attachments.
                    const payload = up === undefined
                        ? own
                        : upIsString
                            ? [own, ...toArray(up)]
                            : [...toArray(up), own];
                    const toolsPayload = toArray(upTools);

                    onResultUpdate(id, {payload, ...(toolsPayload.length > 0 ? {toolsPayload} : {})});
                } catch (e) {
                    setError("Invalid JSON data: " + (e instanceof Error ? e.message : String(e)));

                    onResultUpdate(id);
                }

                return;
            } else if(dataSource.type === DATA_SOURCE_TYPES.MARKDOWN_AND_FILES) {
                let own = dataSource.value?.text || "";
                let imageCounter = 1;
                const ownTools: AttachedFile[] = [];

                for (const file of dataSource.value?.files || []) {
                    const ext = file.name.split('.').pop()?.toLowerCase() || "";
                    // isToolsPayload=undefined means infer from extension (backward compat with saved workflows)
                    const isToolsPayload = file.isToolsPayload ?? BINARY_FILE_EXTENSIONS.has(ext);

                    if (isToolsPayload && file.base64) {
                        // Binary attachment: add a note the LLM can read, collect for tool use.
                        own += `\n\n[Binary attachment: ${file.name} — available for form file-upload fields]\n\n`;

                        ownTools.push({name: file.name, base64: file.base64, mimeType: file.mimeType || "application/octet-stream"});
                    } else if (isToolsPayload) {
                        // isToolsPayload=true but no base64 — skip silently (shouldn't happen with new files)
                    } else if (IMAGE_FILE_EXTENSIONS.has(ext)) {
                        own += `\n\n${markdownImageFilePrefix(imageCounter++, file.name)}${file.content}\n\n`;
                    } else {
                        own += `\n\n${markdownFilePrefix(file.name)}${file.content}\n\n`;
                    }
                }

                // Both naturally textual — join into one document rather than keeping separate
                // array elements. Otherwise, upstream is kept distinct (spread if already an
                // array, wrapped as one element otherwise) with own appended last.
                const payload = up === undefined
                    ? own
                    : upIsString
                        ? up + own
                        : [...toArray(up), own];
                const toolsPayload = [...toArray(upTools), ...ownTools];

                onResultUpdate(id, {payload, ...(toolsPayload.length > 0 ? {toolsPayload} : {})});
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