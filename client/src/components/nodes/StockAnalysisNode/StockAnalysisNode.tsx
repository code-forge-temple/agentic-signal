/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsStockAnalysisNodeData} from "./types/workflow";
import {StockAnalysisInputSchema, StockDataPoint} from "./types/stock.types";
import {useState} from "react";
import {BaseNode} from "../BaseNode";
import {runTask} from "../BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {LogsDialog} from "../../LogsDialog";
import {ERROR_PREFIX, Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {computeIndicators} from "./utils";


export function StockAnalysisNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsStockAnalysisNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [openLogs, setOpenLogs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {title, input, onResultUpdate} = data;

    useAutoRunOnInputChange({
        clearError: ()=> {setError(null)},
        clearOutput: () => {onResultUpdate(id)},
        runCallback: () => {
            runTask(async () => {
                try {
                    const validation = StockAnalysisInputSchema.safeParse(input);

                    if (!validation.success) {
                        setError(`${ERROR_PREFIX}Stock analysis input validation failed: ` + JSON.stringify(validation.error.errors, null, 2));

                        onResultUpdate(id);

                        return;
                    }

                    const {symbol, data} = validation.data;

                    if (data.length < 10) {
                        setError("Data array must have at least 10 points.");

                        onResultUpdate(id);

                        return;
                    }

                    const analysis = computeIndicators(data as StockDataPoint[]);

                    onResultUpdate(id, {symbol, ...analysis});
                } catch (err) {
                    setError(err instanceof Error ? err.message : `Unknown error:\n${JSON.stringify(err, null, 4)}`);

                    onResultUpdate(id);
                }
            }, setIsRunning);
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
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
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
