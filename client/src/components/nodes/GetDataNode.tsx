/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useState} from "react";
import {AppNode, assertIsEnhancedNodeData, assertIsGetDataNodeData} from "../../types/workflow";
import {BaseNode} from "./BaseNode";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";

import {runTask} from "./BaseNode/utils";
import {BaseDialog} from "../BaseDialog";
import {LogsDialog} from "../LogsDialog";
import {FetchDataType, TaskNodeIcons} from "../../constants";
import {parseUrl} from "../../utils";
import {DebouncedTextField} from "../DebouncedTextField";
import {useTimerTrigger} from "../../hooks/useTimerTrigger";
import {TimerTriggerPort} from "./TimerNode/TimerTriggerPort";

const DATA_TYPE_LABEL = "Data Type";

export function GetDataNode ({data, id, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsGetDataNodeData(data);

    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const {input, url, title, dataType, onResultUpdate, onConfigChange} = data;

    const handleRun = useCallback(() => {
        setError(null);
        onResultUpdate(id);

        runTask(async () => {
            try {
                const parsedUrl = parseUrl(url);

                const response = await fetch(parsedUrl);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                let getData;

                switch (dataType) {
                    case "json":
                        getData = await response.json();
                        break;
                    case "text":
                        getData = await response.text();
                        break;
                    case "blob":
                        getData = await response.blob();
                        break;
                    case "arrayBuffer":
                        getData = await response.arrayBuffer();
                        break;
                    default:
                        getData = await response.text();
                }

                onResultUpdate(id, getData);
            } catch (error) {
                setError(`Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`);

                onResultUpdate(id);
            }

        }, setIsRunning);
    }, [data, id]);

    useTimerTrigger(input?.timerTrigger, handleRun);

    const hasMissingConfig = !url || !dataType;

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={TaskNodeIcons[type]}
                ports={{
                    output: true
                }}
                extraPorts = {
                    <TimerTriggerPort />
                }
                title={title}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                run={handleRun}
                running={isRunning}
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
                <DebouncedTextField
                    label="URL"
                    variant="outlined"
                    fullWidth
                    value={url}
                    onChange={(value) => {
                        onConfigChange(id, {url: value});
                    }}
                    sx={{mb: 2}}
                />
                <FormControl fullWidth size="small" sx={{mb: 2, mt: 1}}>
                    <InputLabel id="data-type-label">{DATA_TYPE_LABEL}</InputLabel>
                    <Select
                        labelId="data-type-label"
                        label={DATA_TYPE_LABEL}
                        value={dataType || ""}
                        onChange={e => {
                            onConfigChange(id, {dataType: e.target.value});
                        }}
                    >
                        <MenuItem value="" disabled>
                            {"Select a data type..."}
                        </MenuItem>
                        {Object.values(FetchDataType).map(dataType => (
                            <MenuItem key={dataType} value={dataType}>{dataType}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </BaseDialog>
        </>
    );
}