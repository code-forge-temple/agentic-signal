/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Line} from "react-chartjs-2";
import {CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip} from "chart.js";
import {BaseDialog} from "../../../BaseDialog";
import {CodeEditor} from "../../../CodeEditor";
import {FieldsetGroup} from "../../../FieldsetGroup";
import {CHART_INPUT_JSON_SCHEMA} from "../types/input.types";
import {LineData} from "../utils/lineData";
import "ace-builds/src-noconflict/mode-json";


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type DialogProps = {open: boolean; onClose: () => void; title: string};

/** The Chart node's settings: only the input format it expects. */
export function ChartSettings ({open, onClose, title}: DialogProps) {
    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            <FieldsetGroup title="Expected Input Format *" height={"100%"} collapsible defaultCollapsed>
                <CodeEditor mode="json" value={CHART_INPUT_JSON_SCHEMA} readOnly={true} showLineNumbers={true} />
            </FieldsetGroup>
        </BaseDialog>
    );
}

/** The chart itself, or "No data". */
export function ChartOutput ({open, onClose, title, lineData}: DialogProps & {lineData: LineData | undefined}) {
    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            {lineData ? (
                <div style={{width: "100%", height: "100%", minHeight: 0}}>
                    <Line
                        data={lineData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {display: true},
                                title: {display: true, ...('title' in lineData ? {text: lineData.title} : {})},
                            },
                        }}
                        style={{width: "100%", height: "100%"}}
                    />
                </div>
            ) : (
                <div style={{color: "#888", fontSize: 12}}>No data</div>
            )}
        </BaseDialog>
    );
}
