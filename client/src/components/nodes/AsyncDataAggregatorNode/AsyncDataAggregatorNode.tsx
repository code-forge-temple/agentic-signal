/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps, useReactFlow} from "@xyflow/react";
import {assertIsAsyncDataAggregatorNodeData} from "./types/workflow";
import {useState, useCallback, useMemo} from "react";
import {BaseNode} from "../BaseNode";
import {LogsDialog} from "../../LogsDialog";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {runTask} from "../BaseNode/utils";


export function AsyncDataAggregatorNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsAsyncDataAggregatorNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [openLogs, setOpenLogs] = useState(false);
    const {title, input, onConfigChange, onResultUpdate} = data;
    const [isRunning, setIsRunning] = useState(false);
    const {getEdges} = useReactFlow();
    const collectedInputs: Record<string, any> = useMemo(() => input ?? {}, [input]);

    const allArrived = useCallback(() => {
        const connectedSourceIds = getEdges()
            .filter(e => e.target === id)
            .map(e => e.source);

        if (connectedSourceIds.length === 0) return false;

        return connectedSourceIds.every(srcId => srcId in collectedInputs);
    }, [getEdges, id, collectedInputs]);

    useAutoRunOnInputChange({
        clearError: () => { setError(null); },
        clearOutput: () => { if (allArrived()) onResultUpdate(id); },
        runCallback: () => {
            const connectedSourceIds = getEdges()
                .filter(e => e.target === id)
                .map(e => e.source);

            if (connectedSourceIds.length === 0) return;

            if (allArrived()) {
                runTask(async () => {
                    onResultUpdate(id, connectedSourceIds.map(srcId => collectedInputs[srcId]));
                    onConfigChange(id, {input: {}});
                }, setIsRunning);
            }
        }
    }, [input]);

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true,
                    output: true
                }}
                running={isRunning}
                title={title}
                logs={{callback: () => setOpenLogs(true), highlight: false}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />
        </>
    );
}
