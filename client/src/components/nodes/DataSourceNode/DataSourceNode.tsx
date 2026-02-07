/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPES} from "./types/workflow";
import {useCallback, useState} from "react";
import {BaseNode} from "../BaseNode";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {Icon, IMAGE_EXTENSIONS} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {JsonInput} from "./components/JsonInput";
import {FilesInput} from "./components/FilesInput";


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
            if (dataSource.type === DATA_SOURCE_TYPES.JSON) {
                try {
                    onResultUpdate(id, JSON.parse(dataSource.value || "{}"));
                } catch (e) {
                    setError("Invalid JSON data: " + (e instanceof Error ? e.message : String(e)));

                    onResultUpdate(id);
                }

                return;
            } else if(dataSource.type === DATA_SOURCE_TYPES.MARKDOWN) {
                let mergedOutput = dataSource.value?.text || "";
                let imageCounter = 1;

                for (const file of dataSource.value?.files || []) {
                    const ext = file.name.split('.').pop()?.toLowerCase() || "";
                    let prefix;

                    if (IMAGE_EXTENSIONS.includes(ext)) {
                        prefix = `### Image ${imageCounter++} attached `;
                    } else {
                        prefix = `### File "${file.name}"\n`;
                    }

                    mergedOutput += `\n\n${prefix}${file.content}\n\n`;
                }

                onResultUpdate(id, mergedOutput);
            }
        }, setIsRunning);
    }, [dataSource.type, dataSource.value, id, onResultUpdate]);

    useTimerTrigger(input?.timerTrigger, handleRun);

    let content;

    if (dataSource.type === DATA_SOURCE_TYPES.JSON) {
        content = <JsonInput value={dataSource.value} onChange={value => onConfigChange(id, {dataSource: {...dataSource, value}})} />;
    } else if (dataSource.type === DATA_SOURCE_TYPES.MARKDOWN) {
        content = <FilesInput value={dataSource.value} onChange={value => onConfigChange(id, {dataSource: {...dataSource, value}})} />;
    }

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
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
                <FormControl fullWidth size="small" sx={{mb: 2, mt: 1}}>
                    <InputLabel id="data-source-type-label">{DATA_SOURCE_TYPE_LABEL}</InputLabel>
                    <Select
                        labelId="data-source-type-label"
                        label={DATA_SOURCE_TYPE_LABEL}
                        value={dataSource.type}
                        onChange={e => {
                            if(e.target.value === DATA_SOURCE_TYPES.JSON) {
                                onConfigChange(id, {dataSource: {type: DATA_SOURCE_TYPES.JSON, value: ""}});
                            } else if (e.target.value === DATA_SOURCE_TYPES.MARKDOWN) {
                                onConfigChange(id, {dataSource: {type: DATA_SOURCE_TYPES.MARKDOWN, value: {text: "", files: []}}});
                            }
                        }}
                    >
                        {
                            Object.values(DATA_SOURCE_TYPES).map(type => (
                                <MenuItem key={type} value={type}>{type}</MenuItem>
                            ))
                        }
                    </Select>
                </FormControl>
                {content}
            </BaseDialog>
        </>
    );
}