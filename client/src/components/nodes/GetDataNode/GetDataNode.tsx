/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useState} from "react";
import {assertIsGetDataNodeData, FetchDataType} from "./types/workflow";
import {GetDataNodeInputSchema, GET_DATA_NODE_INPUT_JSON_SCHEMA} from "./types/input.types";
import {CodeEditor} from "../../CodeEditor";
import {BaseNode} from "../BaseNode";
import {FormControl, InputLabel, MenuItem, Select, FormControlLabel, Switch} from "@mui/material";
import {FieldsetGroup} from "../../FieldsetGroup";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {formatErrorMessage, getField, parseUrl} from "../../../utils";
import {DebouncedTextField} from "../../DebouncedTextField";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {useLatestValue} from "../../../hooks/useLatestValue";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";


const DATA_TYPE_LABEL = "Data Type *";

async function fetchDataFromUrl (url: string, dataType: FetchDataType) {
    const parsedUrl = parseUrl(url);
    const response = await fetch(parsedUrl);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    switch (dataType) {
        case "json":
            return await response.json();
        case "text":
            return await response.text();
        case "blob":
            return await response.blob();
        case "arrayBuffer":
            return await response.arrayBuffer();
        case "csv":
            return await response.text();
        case "xml":
            return await response.text();
        default:
            return await response.text();
    }
}

function validateGetDataInput (url: string | undefined, dataType: FetchDataType | undefined) {
    const validation = GetDataNodeInputSchema.safeParse({url, dataType});

    if (!validation.success) {
        throw new Error(formatErrorMessage("Invalid input", validation.error.issues));
    }

    return validation.data;
}

export function GetDataNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsGetDataNodeData(data);

    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const {input, url, title, dataType, dataProvidedByUpstream, onResultUpdate, onConfigChange} = data;

    const dataProvidedByUpstreamRef = useLatestValue(dataProvidedByUpstream);
    const openSettingsRef = useLatestValue(openSettings);

    const forwardToolsPayload = useCallback(
        () => (input?.toolsPayload !== undefined ? {toolsPayload: input.toolsPayload} : {}),
        [input]
    );

    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => onResultUpdate(id),
        runCallback: async () => {
            if (dataProvidedByUpstreamRef.current && !openSettingsRef.current) {
                runTask(async () => {
                    const upstreamUrl = getField<string | undefined>(input?.payload, "url", undefined);
                    const upstreamDataType = getField<FetchDataType | undefined>(input?.payload, "dataType", undefined);

                    try {
                        const validated = validateGetDataInput(upstreamUrl, upstreamDataType);

                        const getData = await fetchDataFromUrl(validated.url, validated.dataType);

                        onResultUpdate(id, {payload: getData, ...forwardToolsPayload()});
                    } catch (error) {
                        setError(`Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`);

                        onResultUpdate(id);
                    }
                }, setIsRunning);
            }
        }
    }, [input]);

    const mergedUrl: string = getField(dataProvidedByUpstream ? input?.payload : undefined, "url", url);
    const mergedDataType: FetchDataType = getField(dataProvidedByUpstream ? input?.payload : undefined, "dataType", dataType);

    const handleRun = useCallback(() => {
        setError(null);
        onResultUpdate(id);

        runTask(async () => {
            try {
                validateGetDataInput(mergedUrl, mergedDataType);

                const getData = await fetchDataFromUrl(mergedUrl, mergedDataType);

                onResultUpdate(id, {payload: getData, ...forwardToolsPayload()});
            } catch (error) {
                setError(`Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`);

                onResultUpdate(id);
            }
        }, setIsRunning);
    }, [onResultUpdate, id, mergedUrl, mergedDataType, forwardToolsPayload]);

    useTimerTrigger(input?.timerTrigger, handleRun);

    const hasMissingConfig = !dataProvidedByUpstream && (!url || !dataType);

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
                <FieldsetGroup
                    title={`Expected Input Format ${dataProvidedByUpstream ? "*" : "(when Provided by Upstream)"}`}
                    height={"100%"}
                    collapsible
                    defaultCollapsed
                >
                    <CodeEditor
                        mode="json"
                        value={GET_DATA_NODE_INPUT_JSON_SCHEMA}
                        readOnly={true}
                        disabled={!dataProvidedByUpstream}
                        showLineNumbers={true}
                    />
                </FieldsetGroup>
                <FormControlLabel
                    sx={{m: 0, mb: 2}}
                    control={
                        <Switch
                            checked={dataProvidedByUpstream || false}
                            onChange={e => onConfigChange(id, {
                                dataProvidedByUpstream: e.target.checked,
                                url: mergedUrl,
                                dataType: mergedDataType,
                            })}
                        />
                    }
                    label="Provided by Upstream"
                    labelPlacement="start"
                />
                <FieldsetGroup title="Upstream Data Configuration">
                    <DebouncedTextField
                        label="URL *"
                        variant="outlined"
                        fullWidth
                        value={mergedUrl}
                        onChange={(value) => {
                            onConfigChange(id, {url: value});
                        }}
                        sx={{mb: 2}}
                        disabled={dataProvidedByUpstream}
                    />
                    <FormControl fullWidth size="small" sx={{mb: 2, mt: 1}}>
                        <InputLabel id="data-type-label">{DATA_TYPE_LABEL}</InputLabel>
                        <Select
                            labelId="data-type-label"
                            label={DATA_TYPE_LABEL}
                            value={mergedDataType}
                            onChange={e => {
                                onConfigChange(id, {dataType: e.target.value});
                            }}
                            disabled={dataProvidedByUpstream}
                        >
                            <MenuItem value="" disabled>
                                {"Select a data type..."}
                            </MenuItem>
                            {Object.values(FetchDataType).map(dataType => (
                                <MenuItem key={dataType} value={dataType}>{dataType}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </FieldsetGroup>
            </BaseDialog>
        </>
    );
}