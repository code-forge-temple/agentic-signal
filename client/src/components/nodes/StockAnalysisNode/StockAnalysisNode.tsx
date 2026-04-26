/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsStockAnalysisNodeData} from "./types/workflow";
import {StockAnalysisInputSchema, StockDataPoint, STOCK_ANALYSIS_INPUT_JSON_SCHEMA} from "./types/input.types";
import {useState} from "react";
import {BaseNode} from "../BaseNode";
import {runTask} from "../BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {LogsDialog} from "../../LogsDialog";
import {BaseDialog} from "../../BaseDialog";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {computeIndicators, formatFeedbackMessage} from "./utils";
import {CodeEditor} from "../../CodeEditor";
import "ace-builds/src-noconflict/mode-json";
import {FieldsetGroup} from "../../FieldsetGroup";


export function StockAnalysisNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsStockAnalysisNodeData(data);

    const [error, setError] = useState<string[] | null>(null);
    const [openLogs, setOpenLogs] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {title, input, onResultUpdate, onFeedbackSend} = data;

    useAutoRunOnInputChange({
        clearError: ()=> {setError(null)},
        clearOutput: () => {onResultUpdate(id)},
        runCallback: () => {
            runTask(async () => {
                try {
                    const validation = StockAnalysisInputSchema.safeParse(input);

                    if (!validation.success) {
                        setError(prev => {

                            const newError = `Stock analysis input validation failed: ` + JSON.stringify(validation.error.errors, null, 4);

                            return prev ? [...prev, newError] : [newError];
                        });

                        onFeedbackSend(
                            id,
                            formatFeedbackMessage(
                                "Stock analysis",
                                STOCK_ANALYSIS_INPUT_JSON_SCHEMA,
                                JSON.stringify(input, null, 4),
                                JSON.stringify(validation.error.errors, null, 4)
                            )
                        );

                        onResultUpdate(id);

                        return;
                    }

                    const {symbol, data} = validation.data;

                    if (data.length < 10) {
                        setError(prev => {
                            const newError = "Data array must have at least 10 points.";

                            return prev ? [...prev, newError] : [newError];
                        });

                        onResultUpdate(id);

                        return;
                    }

                    const analysis = computeIndicators(data as StockDataPoint[]);

                    onResultUpdate(id, {symbol, ...analysis});
                } catch (err) {
                    setError(prev => {
                        const newError = err instanceof Error ? err.message : `Unknown error:\n${JSON.stringify(err, null, 4)}`;

                        return prev ? [...prev, newError] : [newError];
                    });

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
                settings={{callback: () => setOpenSettings(true), highlight: false}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title={title}>
                <FieldsetGroup title="Expected Input Format">
                    <CodeEditor
                        mode="json"
                        value={STOCK_ANALYSIS_INPUT_JSON_SCHEMA}
                        readOnly={true}
                        showLineNumbers={true}
                    />
                </FieldsetGroup>
            </BaseDialog>
        </>
    );
}
