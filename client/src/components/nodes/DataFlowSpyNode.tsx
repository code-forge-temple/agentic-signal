/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {AppNode, assertIsDataFlowSpyNodeData, assertIsEnhancedNodeData} from "../../types/workflow";
import {useState} from "react";
import {BaseNode} from "./BaseNode";
import {formatContentForDisplay} from "../../utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../hooks/useRunOnTriggerChange";
import {runTask} from "./BaseNode/utils";
import {BaseDialog} from "../BaseDialog";
import {LogsDialog} from "../LogsDialog";
import {TaskNodeIcons} from "../../constants";
import {MarkdownRenderer} from "../MarkdownRenderer";


export function DataFlowSpyNode ({id, data, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataFlowSpyNodeData(data);

    const [openOutput, setOpenOutput] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
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

    let displayedValue;

    try {
        displayedValue = formatContentForDisplay(input);
    }
    catch (err) {
        setError(`Error formatting content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={TaskNodeIcons[type]}
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
                <MarkdownRenderer content={displayedValue || "No output available"} />
            </BaseDialog>
        </>
    );
}