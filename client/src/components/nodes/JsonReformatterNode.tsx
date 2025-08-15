/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {AppNode, assertIsEnhancedNodeData, assertIsJsonReformatterNodeData} from "../../types/workflow";
import {useState} from "react";
import jsonata from "jsonata";
import {BaseNode} from "./BaseNode";
import {CodeEditor} from "../CodeEditor";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-terminal";
import {runTask} from "./BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../hooks/useRunOnTriggerChange";
import {BaseDialog} from "../BaseDialog";
import {LogsDialog} from "../LogsDialog";
import {TaskNodeIcons} from "../../constants";
import {useDebouncedState} from "../../hooks/useDebouncedState";


export function JsonReformatterNode ({data, id, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsJsonReformatterNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {title, jsonataExpression, input, onResultUpdate, onConfigChange} = data;

    useAutoRunOnInputChange({
        clearError: ()=> {setError(null)},
        clearOutput: () => {onResultUpdate(id)},
        runCallback: () => {
            runTask(async () => {
                const evaluateExpression = async () => {
                    if (jsonataExpression.trim()) {
                        try {
                            const expression = jsonata(jsonataExpression);
                            const transformedData = await expression.evaluate(input);

                            onResultUpdate(id, transformedData);
                        } catch (err) {
                            setError(err instanceof Error ? err.message : `Unknown error:\n${JSON.stringify(err, null, 4)}`);

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
            <BaseNode
                id={id}
                nodeIcon={TaskNodeIcons[type]}
                ports={{
                    input: true,
                    output: true
                }}
                running={isRunning}
                title={title}
                settings={() => setOpenSettings(true)}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
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