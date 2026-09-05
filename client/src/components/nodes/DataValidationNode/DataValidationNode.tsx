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
import {BasicTabs} from "../../Tabs/Tabs";
import {Box, Switch, Tooltip} from "@mui/material";


const ajv = new Ajv();

function validateAgainstSchema (schema: string | undefined, value: unknown): {valid: boolean; message?: string} {
    if (!schema) {
        return {valid: true};
    }

    try {
        const parsedSchema = JSON.parse(schema);
        const validateFn = ajv.compile(parsedSchema);
        const valid = validateFn(value);

        return valid ? {valid: true} : {valid: false, message: ajv.errorsText(validateFn.errors)};
    } catch (e) {
        return {valid: false, message: e instanceof Error ? e.message : String(e)};
    }
}

export function DataValidationNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataValidationNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {
        title, validatePayload, payloadSchema, validateToolsPayload, toolsPayloadSchema,
        input, onResultUpdate, onConfigChange, onFeedbackSend
    } = data;
    const isPayloadValidationOn = validatePayload !== false;

    useAutoRunOnInputChange({
        clearError: () => {setError(null)},
        clearOutput: () => {onResultUpdate(id)},
        runCallback: () => {
            runTask(async () => {
                if (isPayloadValidationOn) {
                    const payloadResult = validateAgainstSchema(payloadSchema, input?.payload);

                    if (!payloadResult.valid) {
                        const errorMessage = "Payload: " + payloadResult.message;

                        setError(errorMessage);
                        onFeedbackSend(id, errorMessage);

                        return;
                    }
                }

                if (validateToolsPayload) {
                    const toolsPayloadResult = validateAgainstSchema(toolsPayloadSchema, input?.toolsPayload);

                    if (!toolsPayloadResult.valid) {
                        const errorMessage = "Tools Payload: " + toolsPayloadResult.message;

                        setError(errorMessage);
                        onFeedbackSend(id, errorMessage);

                        return;
                    }
                }

                setError(null);
                onResultUpdate(id, {
                    payload: input?.payload,
                    ...(input?.toolsPayload !== undefined ? {toolsPayload: input.toolsPayload} : {}),
                });
            }, setIsRunning);
        }
    }, [input]);


    const [validationSchema, setValidationSchema] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {payloadSchema: value});
        },
        delay: 300,
        initialValue: payloadSchema || ""
    });

    const [toolsValidationSchema, setToolsValidationSchema] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {toolsPayloadSchema: value});
        },
        delay: 300,
        initialValue: toolsPayloadSchema || ""
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
                settings={{callback: () => setOpenSettings(true), highlight: isPayloadValidationOn && !payloadSchema?.trim()}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title="Validation Schema">
                <BasicTabs
                    tabs={[
                        {
                            title: "Payload Schema",
                            label: (
                                <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                    <Tooltip title={isPayloadValidationOn ? "Payload is validated — a failure blocks all output" : "Payload passes through unvalidated"}>
                                        <span style={{display: "inline-flex"}}>
                                            <Switch
                                                size="small"
                                                checked={isPayloadValidationOn}
                                                onChange={e => onConfigChange(id, {validatePayload: e.target.checked})}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </span>
                                    </Tooltip>
                                    <span>Payload Schema</span>
                                </Box>
                            ),
                            content: (
                                <CodeEditor
                                    mode="json"
                                    value={validationSchema}
                                    onChange={setValidationSchema}
                                    disabled={!isPayloadValidationOn}
                                    placeholder={
                                        isPayloadValidationOn
                                            ? "Enter JSON Schema for validation (leave blank to skip)"
                                            : "Enable the switch on this tab to configure payload validation"
                                    }
                                />
                            )
                        },
                        {
                            title: "Tools Payload Schema",
                            label: (
                                <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                                    <Tooltip title={validateToolsPayload ? "Tools Payload is validated — a failure blocks all output" : "Tools Payload passes through unvalidated"}>
                                        <span style={{display: "inline-flex"}}>
                                            <Switch
                                                size="small"
                                                checked={validateToolsPayload || false}
                                                onChange={e => onConfigChange(id, {validateToolsPayload: e.target.checked})}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </span>
                                    </Tooltip>
                                    <span>Tools Payload Schema</span>
                                </Box>
                            ),
                            content: (
                                <CodeEditor
                                    mode="json"
                                    value={toolsValidationSchema}
                                    onChange={setToolsValidationSchema}
                                    disabled={!validateToolsPayload}
                                    placeholder={
                                        validateToolsPayload
                                            ? "Enter JSON Schema for Tools Payload validation (leave blank to skip; a failure blocks all output)"
                                            : "Enable the switch on this tab to configure Tools Payload validation"
                                    }
                                />
                            )
                        }
                    ]}
                />
            </BaseDialog>
        </>
    );
}
