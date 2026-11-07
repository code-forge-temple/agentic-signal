/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsJsonReformatterNodeData} from "./types/workflow";
import {useState} from "react";
import jsonata from "jsonata";
import {MonitoredNode} from "../MonitoredNode";
import {CodeEditor} from "../../CodeEditor";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-terminal";
import {runTask} from "../BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {BaseDialog} from "../../BaseDialog";
import {useDebouncedState} from "../../../hooks/useDebouncedState";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {formatErrorMessage, isRecord} from "../../../utils/utils";

// JSONata throws plain objects ({code, message, position, stack}), not Errors: show the message and where
// in the expression it went wrong, not the whole object. $error("…") (code D3137) is a message meant as is.
function jsonataErrorMessage (err: unknown): string {
    if (err instanceof Error) return err.message;

    if (isRecord(err) && typeof err.message === "string") {
        return typeof err.position === "number" && err.code !== "D3137"
            ? `${err.message} (at character ${err.position} of the expression)`
            : err.message;
    }

    return formatErrorMessage("Unknown error", err);
}


export function JsonReformatterNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsJsonReformatterNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {title, jsonataExpression, input, onResultUpdate, onConfigChange} = data;

    useAutoRunOnInputChange({
        clearError: ()=> {setError(null)},
        clearOutput: () => {onResultUpdate(id)},
        runCallback: () => {
            void runTask(async () => {
                const evaluateExpression = async () => {
                    if (jsonataExpression.trim()) {
                        try {
                            const expression = jsonata(jsonataExpression);
                            const transformedData: unknown = await expression.evaluate(input?.payload);

                            onResultUpdate(id, {
                                payload: transformedData,
                                ...(input?.toolsPayload !== undefined ? {toolsPayload: input.toolsPayload} : {}),
                            });
                        } catch (err) {
                            setError(jsonataErrorMessage(err));

                            onResultUpdate(id);
                        }
                    } else {
                        onResultUpdate(id);
                    }
                }

                await evaluateExpression();
            }, setIsRunning);
        }
    }, [input]);

    const [debouncedJsonataExpression, setDebouncedJsonataExpression] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {jsonataExpression: value});
        },
        delay: 300,
        initialValue: jsonataExpression
    });

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true,
                    output: true
                }}
                running={isRunning}
                title={title}
                settings={() => setOpenSettings(true)}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
            >
                <CodeEditor
                    placeholder="JSONata expression (e.g., $keys($.products) or $.items[price > 10])"
                    mode="javascript"
                    value={debouncedJsonataExpression}
                    onChange={setDebouncedJsonataExpression}
                    showLineNumbers={true}
                />
            </BaseDialog>
        </>
    );
}