/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsChartNodeData} from "./types/workflow";
import {useMemo, useState} from "react";
import {MonitoredNode} from "../MonitoredNode";
import {ChartDataSchema, type ChartData, CHART_INPUT_JSON_SCHEMA} from "./types/input.types";
import {runTask} from "../BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {formatFeedbackMessage} from "../StockAnalysisNode/utils";
import {formatErrorMessage} from "../../../utils/utils";
import {toLineData} from "./utils/lineData";
import {ChartOutput, ChartSettings} from "./components/ChartDialogs";


export function ChartNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsChartNodeData(data);

    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openOutput, setOpenOutput] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {input, title, onFeedbackSend} = data;

    // Input the chart can't draw goes back upstream as feedback.
    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => {},
        runCallback: () => runTask(async () => {
            const validation = ChartDataSchema.safeParse(input?.payload);

            if (validation.success) {
                setChartData(validation.data);

                return;
            }

            setError(formatErrorMessage("Chart data validation failed", validation.error));
            setChartData(null);
            onFeedbackSend(id, formatFeedbackMessage("Chart", CHART_INPUT_JSON_SCHEMA, JSON.stringify(input?.payload, null, 4), JSON.stringify(validation.error.errors, null, 4)));
        }, setIsRunning),
    }, [input]);

    const lineData = useMemo(() => toLineData(chartData, title), [chartData, title]);

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{input: true}}
                running={isRunning}
                title={title}
                output={{callback: () => setOpenOutput(true), highlight: lineData !== undefined}}
                error={error}
                settings={() => setOpenSettings(true)}
            />
            <ChartSettings open={openSettings} onClose={() => setOpenSettings(false)} title={title} />
            <ChartOutput open={openOutput} onClose={() => setOpenOutput(false)} title={title} lineData={lineData} />
        </>
    );
}
