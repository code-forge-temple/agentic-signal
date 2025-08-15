/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow, type NodeProps} from "@xyflow/react";
import {AppNode, assertIsEnhancedNodeData, assertIsLlmProcessNodeData, assertIsToolNodeData, ToolNode} from "../../../types/workflow";
import {useCallback, useEffect, useRef, useState} from "react";
import {BaseNode} from "../BaseNode";
import {FormControl, InputLabel, MenuItem, Select, TextField} from "@mui/material";
import {CodeEditor} from "../../CodeEditor";
import {useAIProcessor} from "./hooks/useAIProcessor";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {BasicTabs} from "../../Tabs/Tabs";
import {useRunOnTriggerChange as useAutoRunOnFeedbackChange} from "../../../hooks/useRunOnTriggerChange";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {AI_TOOL_PORT_COLOR, TaskNodeIcons, TaskNodeType, TOOL_PORT_ID} from "../../../constants";
import {ToolSchema} from "../../../types/ollama.types";
import {useDebouncedState} from "../../../hooks/useDebouncedState";

const LLM_MODEL_LABEL = "LLM Model";

export function LLMProcessNode ({data, id, type}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsLlmProcessNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const currentRetryRef = useRef(0);
    const {getNodes, getEdges} = useReactFlow();
    const {
        title,
        model,
        prompt,
        message,
        conversationHistory,
        input,
        format,
        feedback,
        maxFeedbackLoops,
        onResultUpdate,
        onConfigChange,
        onFeedbackSend
    } = data;
    const maxLoops = (maxFeedbackLoops);

    const connectedToolNodes = getEdges()
        .filter(edge => edge.target === id && edge.targetHandle === TOOL_PORT_ID)
        .map(edge => getNodes().find(node => node.id === edge.source))
        .filter((node): node is ToolNode => !!node && node.type === TaskNodeType.AI_TOOL)
        .map(node => {
            assertIsToolNodeData(node.data);

            return node;
        });

    const tools = connectedToolNodes
        .filter(node => typeof node.data.handler === "function")
        .map(node => ({
            schema: node.data.toolSchema as ToolSchema,
            handler: node.data.handler as (params: any) => Promise<any>
        }));

    const {
        processAIRequest,
        fetchModels,
        models,
        isFetchingModels,
        error,
        clearError,
    } = useAIProcessor({
        onSuccess: (result) => {
            onResultUpdate(id, result);
        },
        onError: (errorMessage) => {
            onResultUpdate(id);

            onFeedbackSend(id, errorMessage);
        }
    });

    useEffect(() => {
        if (openSettings) {
            fetchModels().then(fetchedModels => {
                if (model && !fetchedModels.includes(model)) {
                    onConfigChange(id, {model: ""});
                }
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openSettings]);

    useAutoRunOnFeedbackChange({
        clearError: () => { if(currentRetryRef.current < maxLoops) clearError(); },
        clearOutput: () => { if(currentRetryRef.current < maxLoops) onResultUpdate(id); },
        runCallback: async () => {
            if (currentRetryRef.current++ < maxLoops) {
                await runTask(async () => {
                    await processAIRequest({
                        input: input,
                        prompt: prompt,
                        message: message,
                        model: model,
                        format: format,
                        tools,
                        feedback: feedback,
                        conversationHistory: {
                            value: conversationHistory || [],
                            onChange: (newHistory) => {
                                onConfigChange(id, {
                                    conversationHistory: currentRetryRef.current < maxLoops ? newHistory : [],
                                    feedback: undefined
                                });
                            }
                        }
                    });
                }, setIsRunning);
            }
        }
    }, [feedback]);

    useAutoRunOnInputChange({
        clearError: () => {clearError(); },
        clearOutput: () => {onResultUpdate(id); },
        runCallback: async () => {
            currentRetryRef.current = 0;

            await runTask(async () => {
                await processAIRequest({
                    input: input,
                    prompt: prompt,
                    message: message,
                    model: model,
                    format: format,
                    tools,
                    conversationHistory: {
                        value: [],
                        onChange: (newHistory) => {
                            onConfigChange(id, {conversationHistory: newHistory, feedback: undefined});
                        }
                    },
                });
            }, setIsRunning);
        }
    }, [input]);

    const handleRun = useCallback(async () => {
        clearError();
        onResultUpdate(id);

        currentRetryRef.current = 0;

        await runTask(async () => {
            await processAIRequest({
                input: input,
                prompt: prompt,
                message: message,
                model: model,
                format: format,
                tools,
                feedback: feedback,
                conversationHistory: {
                    value: [],
                    onChange: (newHistory) => {
                        onConfigChange(id, {conversationHistory: newHistory, feedback: undefined});
                    }
                },
            });
        }, setIsRunning);
    }, [clearError, feedback, format, id, input, message, model, onConfigChange, onResultUpdate, processAIRequest, prompt, tools]);

    const [systemPrompt, setSystemPrompt] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {prompt: value});
        },
        delay: 300,
        initialValue: prompt || ""
    });
    const [messagePrefix, setMessagePrefix] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {message: {...message, preffix: value}});
        },
        delay: 300,
        initialValue: message?.preffix || ""
    });
    const [messageSuffix, setMessageSuffix] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {message: {...message, suffix: value}});
        },
        delay: 300,
        initialValue: message?.suffix || ""
    });
    const [formatOnSuccess, setFormatOnSuccess] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {format: {...format, onSuccess: value}});
        },
        delay: 300,
        initialValue: format?.onSuccess || ""
    });
    const [formatOnError, setFormatOnError] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {format: {...format, onError: value}});
        },
        delay: 300,
        initialValue: format?.onError || ""
    });

    const {getNode} = useReactFlow();

    const hasMissingConfig = !model || (model && models.length && !models.includes(model)) || false;

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={TaskNodeIcons[type]}
                ports={{
                    input: true,
                    output: true
                }}
                title={title}
                run={handleRun}
                running={isRunning}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
                extraPorts = {
                    <Handle
                        type="target"
                        id={TOOL_PORT_ID}
                        position={Position.Bottom}
                        style={{left: 20, backgroundColor: AI_TOOL_PORT_COLOR}}
                        isValidConnection={({source}) => {
                            return getNode(source)?.type === TaskNodeType.AI_TOOL;
                        }}
                    />
                }
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
                <FormControl fullWidth size="small" sx={{mb: 2, mt: 1}}>
                    <InputLabel id="llm-label">{LLM_MODEL_LABEL}</InputLabel>
                    <Select
                        labelId="llm-label"
                        label={LLM_MODEL_LABEL}
                        value={model || ""}
                        onChange={e => {
                            onConfigChange(id, {model: e.target.value});
                        }}
                        disabled={isFetchingModels}
                    >
                        <MenuItem value="" disabled>
                            {isFetchingModels ? "Loading models..." : "Select a model..."}
                        </MenuItem>
                        {models.map(model => (
                            <MenuItem key={model} value={model}>{model}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    label="Max Feedback Loops"
                    type="number"
                    fullWidth
                    size="small"
                    value={maxLoops}
                    onChange={(e) => {
                        const value = parseInt(e.target.value);

                        onConfigChange(id, {maxFeedbackLoops: Math.max(0, Math.min(10, value))});
                    }}
                    sx={{mb: 2}}
                    helperText={`Current loop: ${Math.min(currentRetryRef.current, maxLoops)}/${maxLoops}`}
                />

                <BasicTabs tabs={[
                    {
                        title: "System Prompt",
                        content: (
                            <CodeEditor
                                mode={"markdown"}
                                placeholder="System prompt that will be used to guide the AI model"
                                value={systemPrompt}
                                onChange={setSystemPrompt}
                                showLineNumbers={true}
                            />
                        )
                    },
                    {
                        title: "User Message",
                        content: (
                            <BasicTabs tabs={[
                                {
                                    title: "Message Prefix",
                                    content: (
                                        <CodeEditor
                                            mode={"markdown"}
                                            placeholder="Prefix (optional) that will be added to the node input before processing"
                                            value={messagePrefix}
                                            onChange={setMessagePrefix}
                                            showLineNumbers={true}
                                        />
                                    )
                                },
                                {
                                    title: "Message Suffix",
                                    content: (
                                        <CodeEditor
                                            mode={"markdown"}
                                            placeholder="Suffix (optional) that will be added to the node input before processing"
                                            value={messageSuffix}
                                            onChange={setMessageSuffix}
                                            showLineNumbers={true}
                                        />
                                    )
                                }
                            ]} />
                        )
                    },
                    {
                        title: "Structured Output",
                        content: (
                            <BasicTabs tabs={[{
                                title: "ON SUCCESS",
                                content: (
                                    <CodeEditor
                                        mode={"json"}
                                        placeholder="Optional JSON schema for structured output on success"
                                        value={formatOnSuccess}
                                        onChange={setFormatOnSuccess}
                                        showLineNumbers={true}
                                    />
                                )
                            },
                            {
                                title: "ON ERROR",
                                content: (
                                    <CodeEditor
                                        mode={"json"}
                                        placeholder="Optional JSON schema for structured output for on error"
                                        value={formatOnError}
                                        onChange={setFormatOnError}
                                        showLineNumbers={true}
                                    />
                                )
                            }]} />
                        )
                    }
                ]} />
            </BaseDialog>
        </>
    );
}