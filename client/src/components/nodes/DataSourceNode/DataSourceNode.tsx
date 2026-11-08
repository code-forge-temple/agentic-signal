/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPE_LABELS, DATA_SOURCE_TYPES} from "./types/workflow";
import {useCallback, useState} from "react";
import {MonitoredNode} from "../MonitoredNode";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {JsonInput} from "./components/JsonInput";
import {FilesInput} from "./components/FilesInput";
import {CodeEditor} from "../../CodeEditor";
import {FieldsetGroup} from "../../FieldsetGroup";
import {DATASOURCE_INPUT_JSON_SCHEMA} from "./types/input.types";
import {buildDataSourceEnvelope} from "./utils";
import {errorMessage} from "@shared/utils";


const DATA_SOURCE_TYPE_LABEL = "Data Source Type";

export function DataSourceNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataSourceNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {title, dataSource, input, onResultUpdate, onConfigChange} = data;

    const handleRun = useCallback(() => {
        setError(null);
        onResultUpdate(id);

        void runTask(async () => {
            // Shared with Workflow Input's outside calls, so both put out the same thing for the same data.
            try {
                onResultUpdate(id, buildDataSourceEnvelope(dataSource, input));
            } catch (e) {
                setError(errorMessage(e));

                onResultUpdate(id);
            }
        }, setIsRunning);
    }, [dataSource, id, onResultUpdate, input]);

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
            <MonitoredNode
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