/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow, type NodeProps} from "@xyflow/react";
import {assertIsLlmProcessNodeData, defaultLlmProcessNodeData} from "./types/workflow";
import {assertIsToolNodeData, ToolNode} from "../ToolNode/types/workflow";
import {useCallback, useEffect, useRef, useState} from "react";
import {BaseNode} from "../BaseNode";
import {Box, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Slider, Switch, Typography} from "@mui/material";
import {CodeEditor} from "../../CodeEditor";
import {useAIProcessor} from "./hooks/useAIProcessor";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {BasicTabs} from "../../Tabs/Tabs";
import {useRunOnTriggerChange as useAutoRunOnFeedbackChange} from "../../../hooks/useRunOnTriggerChange";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../constants";
import {SystemUserConfigValues, ToolSchema} from "../../../types/ollama.types";
import {useDebouncedState} from "../../../hooks/useDebouncedState";
import {DebouncedTextField} from "../../DebouncedTextField";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {NODE_TYPE as TOOL_NODE_TYPE} from "../ToolNode/constants";
import {NODE_TYPE as RAG_NODE_TYPE} from "../RagNode/constants";
import {assertIsRagNodeData, RagNode} from "../RagNode/types/workflow";
import {assertIsEnhancedNodeData} from "../../../types/workflow";


const LLM_MODEL_LABEL = "LLM Model";

export function LlmProcessNode ({data, id}: NodeProps<AppNode>) {
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
        maxToolRetries,
        think,
        temperatureEnabled,
        temperature,
        orchestrationMode,
        onResultUpdate,
        onConfigChange,
        onFeedbackSend
    } = data;

    const connectedToolNodes = getEdges()
        .filter(edge => edge.target === id && edge.targetHandle === NODE_PORT_IDS.TOOL)
        .map(edge => getNodes().find(node => node.id === edge.source))
        .filter((node): node is ToolNode => !!node && node.type === TOOL_NODE_TYPE)
        .map(node => {
            assertIsToolNodeData(node.data);

            return node;
        });

    const tools = connectedToolNodes
        .filter(node => typeof node.data.handler === "function")
        .map(node => ({
            schema: node.data.toolSchema as ToolSchema,
            handler: node.data.handler as (params: any) => Promise<any>,
            systemUserConfigValues: node.data.userConfig as SystemUserConfigValues || {}
        }));

    const connectedRagNode = getEdges()
        .filter(edge => edge.target === id && edge.targetHandle === NODE_PORT_IDS.CONTEXT)
        .map(edge => getNodes().find(node => node.id === edge.source))
        .find((node): node is RagNode => {
            if (!node || node.type !== RAG_NODE_TYPE) return false;

            try {
                assertIsRagNodeData(node.data);

                return true;
            } catch {
                return false;
            }
        });

    const ragHandler = connectedRagNode && typeof connectedRagNode.data.handler === "function"
        ? connectedRagNode.data.handler
        : undefined;

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
        clearError: () => { if(currentRetryRef.current < maxFeedbackLoops) clearError(); },
        clearOutput: () => { if(currentRetryRef.current < maxFeedbackLoops) onResultUpdate(id); },
        runCallback: async () => {
            if (currentRetryRef.current++ < maxFeedbackLoops) {
                await runTask(async () => {
                    await processAIRequest({
                        input: input,
                        prompt: prompt,
                        message: message,
                        model: model,
                        format: format,
                        tools,
                        feedback: feedback,
                        maxToolRetries: maxToolRetries ?? defaultLlmProcessNodeData.maxToolRetries,
                        ragHandler,
                        think: think ?? defaultLlmProcessNodeData.think,
                        temperature: temperatureEnabled ? (temperature ?? defaultLlmProcessNodeData.temperature) : undefined,
                        orchestrationMode: orchestrationMode ?? defaultLlmProcessNodeData.orchestrationMode,
                        conversationHistory: {
                            value: conversationHistory || [],
                            onChange: (newHistory) => {
                                onConfigChange(id, {
                                    conversationHistory: currentRetryRef.current < maxFeedbackLoops ? newHistory : [],
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
                    maxToolRetries: maxToolRetries ?? defaultLlmProcessNodeData.maxToolRetries,
                    ragHandler,
                    think: think ?? defaultLlmProcessNodeData.think,
                    temperature: temperatureEnabled ? (temperature ?? defaultLlmProcessNodeData.temperature) : undefined,
                    orchestrationMode: orchestrationMode ?? defaultLlmProcessNodeData.orchestrationMode,
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
                maxToolRetries: maxToolRetries ?? defaultLlmProcessNodeData.maxToolRetries,
                ragHandler,
                think: think ?? defaultLlmProcessNodeData.think,
                temperature: temperatureEnabled ? (temperature ?? defaultLlmProcessNodeData.temperature) : undefined,
                orchestrationMode: orchestrationMode ?? defaultLlmProcessNodeData.orchestrationMode,
                conversationHistory: {
                    value: [],
                    onChange: (newHistory) => {
                        onConfigChange(id, {conversationHistory: newHistory, feedback: undefined});
                    }
                },
            });
        }, setIsRunning);
    // eslint-disable-next-line max-len
    }, [clearError, feedback, format, id, input, maxToolRetries, message, model, onConfigChange, onResultUpdate, processAIRequest, prompt, ragHandler, temperature, temperatureEnabled, think, tools, orchestrationMode]);

    const [systemPrompt, setSystemPrompt] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {prompt: value});
        },
        delay: 300,
        initialValue: prompt || ""
    });
    const [messagePrefix, setMessagePrefix] = useDebouncedState({
        callback: (value: string) => {
            onConfigChange(id, {message: {...message, prefix: value}});
        },
        delay: 300,
        initialValue: message?.prefix || ""
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

    useTimerTrigger(input?.timerTrigger, handleRun);

    const {getNode} = useReactFlow();

    const hasMissingConfig = !model || (model && models.length && !models.includes(model)) || false;

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true,
                    output: true
                }}
                title={title}
                run={handleRun}
                running={isRunning}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                logs={{callback: () => setOpenLogs(true), highlight: error.length > 0}}
                extraPorts = {
                    <>
                        <Handle
                            type="target"
                            id={NODE_PORT_IDS.TOOL}
                            position={Position.Bottom}
                            style={{left: 30, backgroundColor: NODE_PORT_COLORS.TOOL}}
                            isValidConnection={({source}) => {
                                return getNode(source)?.type === TOOL_NODE_TYPE;
                            }}
                        />
                        <Handle
                            type="target"
                            id={NODE_PORT_IDS.CONTEXT}
                            position={Position.Bottom}
                            style={{left: 10, backgroundColor: NODE_PORT_COLORS.CONTEXT}}
                            isValidConnection={({source}) => {
                                if (getNode(source)?.type !== RAG_NODE_TYPE) return false;

                                const alreadyConnected = getEdges().some(
                                    edge => edge.target === id && edge.targetHandle === NODE_PORT_IDS.CONTEXT
                                );

                                return !alreadyConnected;
                            }}
                        />
                        <TimerTriggerPort />
                    </>
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
                <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0}}>
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

                    <DebouncedTextField
                        label="Max Feedback Loops"
                        type="number"
                        fullWidth
                        size="small"
                        value={maxFeedbackLoops ?? defaultLlmProcessNodeData.maxFeedbackLoops}
                        onChange={(value) => {
                            const parsedValue = parseInt(value);

                            onConfigChange(id, {maxFeedbackLoops: Math.max(0, Math.min(10, parsedValue))});
                        }}
                        sx={{mb: 2}}
                        // eslint-disable-next-line max-len
                        helperText={`Current loop: ${Math.min(currentRetryRef.current, maxFeedbackLoops ?? defaultLlmProcessNodeData.maxFeedbackLoops)}/${maxFeedbackLoops ?? defaultLlmProcessNodeData.maxFeedbackLoops}`}
                    />
                    <DebouncedTextField
                        label="Max Tool Retries"
                        type="number"
                        fullWidth
                        size="small"
                        value={maxToolRetries ?? defaultLlmProcessNodeData.maxToolRetries}
                        onChange={(value) => {
                            const parsedValue = parseInt(value);

                            onConfigChange(id, {maxToolRetries: Math.max(3, Math.min(10, parsedValue))});
                        }}
                        sx={{mb: 2}}
                        helperText="Maximum number of retry attempts for each required tool"
                    />
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, ml: 1.5}}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={orchestrationMode ?? defaultLlmProcessNodeData.orchestrationMode}
                                    onChange={e => onConfigChange(id, {orchestrationMode: e.target.checked})}
                                />
                            }
                            label={<Typography variant="body2">AI Orchestration Mode</Typography>}
                        />
                    </Box>
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, ml: 1.5}}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={think ?? defaultLlmProcessNodeData.think}
                                    onChange={e => onConfigChange(id, {think: e.target.checked})}
                                />
                            }
                            label={<Typography variant="body2">Thinking</Typography>}
                        />
                    </Box>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 2, ml: 1.5}}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={temperatureEnabled ?? defaultLlmProcessNodeData.temperatureEnabled}
                                    onChange={e => onConfigChange(id, {temperatureEnabled: e.target.checked})}
                                />
                            }
                            label={<Typography variant="body2">Temperature</Typography>}
                        />
                        <Slider
                            size="small"
                            disabled={!(temperatureEnabled ?? defaultLlmProcessNodeData.temperatureEnabled)}
                            min={0}
                            max={2}
                            step={0.1}
                            value={temperature ?? defaultLlmProcessNodeData.temperature}
                            onChange={(_, value) => onConfigChange(id, {temperature: value as number})}
                            valueLabelDisplay="auto"
                            sx={{flex: 1}}
                        />
                        <Typography variant="body2" sx={{minWidth: 28, textAlign: 'right'}}>
                            {(temperature ?? defaultLlmProcessNodeData.temperature).toFixed(1)}
                        </Typography>
                    </Box>
                    <Box sx={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'}}>
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
                                    <BasicTabs key="user-message-tabs" tabs={[
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
                                    <BasicTabs key="structured-output-tabs" tabs={[{
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
                    </Box>
                </Box>
            </BaseDialog>
        </>
    );
}