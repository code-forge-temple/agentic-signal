/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsDataFlowSpyNodeData} from "./types/workflow";
import {useState, useEffect} from "react";
import {BaseNode} from "../BaseNode";
import {formatContentForDisplay} from "../../../utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {MarkdownRenderer} from "../../MarkdownRenderer";
import {reformatContent} from "./utils/contentParser";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";


const NO_OUTPUT_AVAILABLE = "No output available";

export function DataFlowSpyNode ({id, data}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataFlowSpyNodeData(data);

    const [openOutput, setOpenOutput] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [formattedValue, setFormattedValue] = useState<string>("");
    const [formatting, setFormatting] = useState(false);

    const {title, input, onResultUpdate} = data;

    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => {onResultUpdate(id)},
        runCallback: async () => {
            await runTask(async () => {
                onResultUpdate(id, input);
            }, setIsRunning);
        }
    }, [input]);

    let displayedValue: string | undefined = undefined;

    try {
        displayedValue = formatContentForDisplay(input);
    }
    catch (err) {
        setError(`Error formatting content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    useEffect(() => {
        setFormatting(true);
        setTimeout(() => {
            setFormattedValue(reformatContent(displayedValue || NO_OUTPUT_AVAILABLE));
            setFormatting(false);
        }, 0);
    }, [displayedValue]);

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
                output={{callback: () => setOpenOutput(true), highlight: displayedValue !== undefined}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog
                open={openOutput}
                onClose={() => setOpenOutput(false)}
                title={title}
            >
                {formatting ? (
                    <div style={{textAlign: "center", padding: "2em"}}>
                        <span>Formatting large content...</span>
                    </div>
                ) : (
                    <MarkdownRenderer content={formattedValue} />
                )}
            </BaseDialog>
        </>
    );
}