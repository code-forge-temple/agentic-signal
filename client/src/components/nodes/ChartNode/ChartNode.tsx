/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsChartNodeData} from "./types/workflow";
import {useMemo, useState} from "react";
import {Line} from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from "chart.js";
import {BaseNode} from "../BaseNode";
import {ChartDataSchema, type ChartData, CHART_INPUT_JSON_SCHEMA} from "./types/chart.types";
import {runTask} from "../BaseNode/utils";
import {LogsDialog} from "../../LogsDialog";
import {BaseDialog} from "../../BaseDialog";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {CodeEditor} from "../../CodeEditor";
import "ace-builds/src-noconflict/mode-json";
import {FieldsetGroup} from "../../FieldsetGroup";
import {formatFeedbackMessage} from "../StockAnalysisNode/utils";


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function randomColor () {
    const r = Math.floor(Math.random() * 200 + 30);
    const g = Math.floor(Math.random() * 200 + 30);
    const b = Math.floor(Math.random() * 200 + 30);

    return `rgb(${r},${g},${b})`;
}

export function ChartNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsChartNodeData(data);

    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openOutput, setOpenOutput] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {input, title, onResultUpdate, onFeedbackSend} = data;

    useAutoRunOnInputChange({
        clearError: () => { setError(null) },
        clearOutput: () => { onResultUpdate(id) },
        runCallback: async () => {
            await runTask(async () => {
                const validationResult = ChartDataSchema.safeParse(input);

                if (validationResult.success) {
                    setChartData(validationResult.data);

                    onResultUpdate(id, validationResult.data);
                } else {
                    setError(`Chart data validation failed: \n${JSON.stringify(validationResult.error, null, 4)}`);

                    setChartData(null);

                    onFeedbackSend(
                        id,
                        formatFeedbackMessage(
                            "Chart",
                            CHART_INPUT_JSON_SCHEMA,
                            JSON.stringify(input, null, 4),
                            JSON.stringify(validationResult.error.errors, null, 4)
                        )
                    )
                }
            }, setIsRunning);
        }
    }, [input]);

    const lineData = useMemo(() => {
        if (!chartData) return undefined;

        // If input is {labels:[], datasets:[...]} (Chart.js format)
        if ('labels' in chartData && 'datasets' in chartData) {
            // If datasets don't have colors, assign random ones
            const datasets = chartData.datasets.map(ds => ({
                borderColor: ds.borderColor || randomColor(),
                backgroundColor: ds.backgroundColor || randomColor(),
                ...ds
            }));

            return {
                labels: chartData.labels,
                datasets,
                ...(chartData.title ? {title: chartData.title} : {})
            };
        }

        // If input is {labels:[], data:[]}
        if ('labels' in chartData && 'data' in chartData) {
            return {
                labels: chartData.labels,
                datasets: [
                    {
                        label: title || "Line",
                        data: chartData.data,
                        borderColor: randomColor(),
                        backgroundColor: randomColor(),
                        tension: 0.4,
                    }
                ],
                ...(chartData.title ? {title: chartData.title} : {})
            };
        }

        // If input is array of {x, y} / array of numbers
        if (Array.isArray(chartData) && chartData.length > 0) {
            const firstItem = chartData[0];

            if (typeof firstItem === 'object' && firstItem !== null && 'x' in firstItem && 'y' in firstItem) {
                const pointArray = chartData as Array<{ x: string | number; y: number }>;

                return {
                    labels: pointArray.map((point) => point.x),
                    datasets: [
                        {
                            label: title || "Line",
                            data: pointArray.map((point) => point.y),
                            borderColor: randomColor(),
                            backgroundColor: randomColor(),
                            tension: 0.4,
                        }
                    ]
                };
            } else if (typeof firstItem === 'number') {
                const numberArray = chartData as number[];

                return {
                    labels: numberArray.map((_, i) => i),
                    datasets: [
                        {
                            label: title || "Line",
                            data: numberArray,
                            borderColor: randomColor(),
                            backgroundColor: randomColor(),
                            tension: 0.4,
                        }
                    ]
                };
            }
        }

        return undefined;
    }, [chartData, title]);

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true
                }}
                running={isRunning}
                title={title}
                output={{callback: () => setOpenOutput(true), highlight: lineData !== undefined}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
                settings={() => setOpenSettings(true)}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title={title}>
                <FieldsetGroup title="Expected Input Format *" height={"100%"}>
                    <CodeEditor
                        mode="json"
                        value={CHART_INPUT_JSON_SCHEMA}
                        readOnly={true}
                        showLineNumbers={true}
                    />
                </FieldsetGroup>
            </BaseDialog>

            <BaseDialog
                open={openOutput}
                onClose={() => setOpenOutput(false)}
                title={title}
            >
                {lineData ? (
                    <div style={{width: "100%", height: "100%", minHeight: 0}}>
                        <Line
                            data={lineData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        display: true
                                    },
                                    title: {
                                        display: true,
                                        ...('title' in lineData ? {text: lineData.title} : {}),
                                    }
                                }
                            }}
                            style={{width: "100%", height: "100%"}}
                        />
                    </div>
                ) : (
                    <div style={{color: "#888", fontSize: 12}}>No data</div>
                )}
            </BaseDialog>
        </>
    );
}