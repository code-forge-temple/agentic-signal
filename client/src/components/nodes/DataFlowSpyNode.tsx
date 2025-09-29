/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {AppNode, assertIsDataFlowSpyNodeData, assertIsEnhancedNodeData} from "../../types/workflow";
import {useState, useEffect} from "react";
import {BaseNode} from "./BaseNode";
import {formatContentForDisplay} from "../../utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../hooks/useRunOnTriggerChange";
import {runTask} from "./BaseNode/utils";
import {BaseDialog} from "../BaseDialog";
import {LogsDialog} from "../LogsDialog";
import {TaskNodeIcons} from "../../constants";
import {MarkdownRenderer} from "../MarkdownRenderer";

const NO_OUTPUT_AVAILABLE = "No output available";

export function DataFlowSpyNode ({id, data, type}: NodeProps<AppNode>) {
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

function reformatContent(value: string): string {
    if (!value) return "";

    const trimmed = value.trim();

    if(trimmed.length > 50000) return trimmed;

    if (/^```(json|js|javascript|html|md|markdown)[\s\S]*```$/m.test(trimmed)) {
        return trimmed;
    }

    try {
        JSON.parse(trimmed);
        return `\`\`\`json\n${trimmed}\n\`\`\``;
    } catch {
        if (/<html[\s\S]*?>[\s\S]*<\/html>/i.test(trimmed) || /<body[\s\S]*?>[\s\S]*<\/body>/i.test(trimmed)) {
            return `\`\`\`html\n${trimmed}\n\`\`\``;
        }
        if (/function\s*\(|=>|\bconst\b|\blet\b|\bvar\b/.test(trimmed)) {
            return `\`\`\`javascript\n${trimmed}\n\`\`\``;
        }
        return trimmed;
    }
}