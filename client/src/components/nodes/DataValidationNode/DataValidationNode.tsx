/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import {NodeProps} from "@xyflow/react";
import {assertIsDataValidationNodeData} from "./types/workflow";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {CodeEditor} from "../../CodeEditor";
import {BaseDialog} from "../../BaseDialog";
import {BaseNode} from "../BaseNode";
import {useDebouncedState} from "../../../hooks/useDebouncedState";
import {LogsDialog} from "../../LogsDialog";
import Ajv from "ajv";
import {runTask} from "../BaseNode/utils";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";


const ajv = new Ajv();

export function DataValidationNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataValidationNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {title, schema, input, onResultUpdate, onConfigChange, onFeedbackSend} = data;

    useAutoRunOnInputChange({
        clearError: ()=> {setError(null)},
        clearOutput: () => {onResultUpdate(id)},
        runCallback: () => {
            runTask(async () => {
                const validate = (input: any) => {
                    try {
                        const parsedSchema = JSON.parse(schema);
                        const validateFn = ajv.compile(parsedSchema);
                        const valid = validateFn(input);

                        if (!valid) {
                            throw new Error("Validation failed: " + ajv.errorsText(validateFn.errors));
                        }

                        onResultUpdate(id, input);
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);

                        setError(errorMessage);

                        onFeedbackSend(id, errorMessage);
                    }
                };

                validate(input);
            }, setIsRunning);
        }
    }, [input]);


    const [validationSchema, setValidationSchema] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {schema: value});
        },
        delay: 300,
        initialValue: schema || ""
    });

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
                settings={{callback: () => setOpenSettings(true), highlight: !schema}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title="Validation Schema">
                <CodeEditor
                    mode="json"
                    value={validationSchema}
                    onChange={setValidationSchema}
                    placeholder="Enter JSON Schema for validation"
                />
            </BaseDialog>
        </>
    );
}