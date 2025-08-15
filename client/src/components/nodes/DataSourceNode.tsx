/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {AppNode, assertIsDataSourceNodeData, assertIsEnhancedNodeData} from "../../types/workflow";
import {useCallback, useState} from "react";
import {BaseNode} from "./BaseNode";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {CodeEditor} from "../CodeEditor";
import {runTask} from "./BaseNode/utils";
import {BaseDialog} from "../BaseDialog";
import {LogsDialog} from "../LogsDialog";
import {TaskNodeIcons} from "../../constants";
import {useDebouncedState} from "../../hooks/useDebouncedState";

const DATA_SOURCE_TYPES = {
    TEXT: "text",
    JSON: "json"
};

const DATA_SOURCE_TYPE_LABEL = "Data Source Type";

export function DataSourceNode ({data, id, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataSourceNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openLogs, setOpenLogs] = useState(false);
    const {title, dataSource, onResultUpdate, onConfigChange} = data;

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
            }

            onResultUpdate(id, dataSource.value || "");

        }, setIsRunning);
    }, [dataSource.type, dataSource.value, id, onResultUpdate]);

    const [debouncedDataSource, setDebouncedDataSource] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {dataSource: {...dataSource, value}});
        },
        delay: 300,
        initialValue: dataSource.value || ""
    });

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={TaskNodeIcons[type]}
                ports={{
                    output: true
                }}
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
                            onConfigChange(id, {dataSource: {...dataSource, type: e.target.value as "json" | "text"}});
                        }}
                    >
                        <MenuItem value={DATA_SOURCE_TYPES.TEXT}>{DATA_SOURCE_TYPES.TEXT}</MenuItem>
                        <MenuItem value={DATA_SOURCE_TYPES.JSON}>{DATA_SOURCE_TYPES.JSON}</MenuItem>
                    </Select>
                </FormControl>
                <CodeEditor
                    mode={dataSource.type === DATA_SOURCE_TYPES.JSON ? "json" : "markdown"}
                    value={debouncedDataSource}
                    onChange={setDebouncedDataSource}
                    showLineNumbers={true}
                />
            </BaseDialog>
        </>
    );
}