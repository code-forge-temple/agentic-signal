/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useReactFlow, type NodeProps} from "@xyflow/react";
import {useEffect, useRef, useState} from "react";
import {v4 as uuidv4} from "uuid";
import {assertIsLlmProcessNodeData, LlmProcessNodeData} from "./types/workflow";
import {MonitoredNode} from "../MonitoredNode";
import {useAIProcessor} from "./hooks/useAIProcessor";
import {runTask} from "../BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnFeedbackChange} from "../../../hooks/useRunOnTriggerChange";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {isModelGone} from "../../../hooks/useFetchModels";
import {Message} from "../../../types/ollama.types";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData, GenericNodeData} from "../../../types/workflow";
import {SessionId} from "../ToolNode/tools/types";
import {cleanupTools, connectedRagHandler, connectedToolNodes, requestTools} from "./utils/connections";
import {requestSettings, runSettings} from "./utils/runSettings";
import {LlmProcessPorts} from "./components/LlmProcessPorts";
import {LlmProcessSettings} from "./components/LlmProcessSettings";


/** Where a run's conversation starts, and how the node keeps what it becomes. */
type Conversation = {
    history: Message[];
    feedback?: string;
    onHistory: (history: Message[]) => void;
};

export function LlmProcessNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsLlmProcessNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const currentRetryRef = useRef(0);
    const {getNodes, getEdges} = useReactFlow();
    const {title, model, prompt, message, format, conversationHistory, input, feedback, onResultUpdate, onConfigChange, onFeedbackSend} = data;
    const {maxFeedbackLoops} = runSettings(data);
    const change = (changes: Partial<LlmProcessNodeData & Pick<GenericNodeData, "feedback">>) => onConfigChange(id, changes);

    const {processAIRequest, fetchModels, models, isFetchingModels, error, clearError} = useAIProcessor({
        // toolsPayload is deliberately never forwarded: it ends here. A workflow that wants an attachment to reach a
        // node after the LLM should fan the source edge out before this node instead of relying on it as a relay.
        onSuccess: result => onResultUpdate(id, {payload: result}),
        onError: errorMessage => {
            onResultUpdate(id);

            onFeedbackSend(id, errorMessage);
        },
    });

    const run = (conversation: Conversation) => {
        const [nodes, edges] = [getNodes(), getEdges()];
        const toolNodes = connectedToolNodes(id, nodes, edges);
        const ragHandler = connectedRagHandler(id, nodes, edges);
        // One session per run, so two runs at once (the same workflow in two tabs, say) get separate browser sessions
        // on the server instead of colliding on the same form URL.
        const sessionId: SessionId = uuidv4();

        return runTask(async () => {
            try {
                await processAIRequest({
                    payload: input?.payload,
                    prompt,
                    message,
                    model,
                    format,
                    tools: requestTools(toolNodes, input?.toolsPayload, sessionId),
                    feedback: conversation.feedback,
                    ragHandler,
                    ...requestSettings(data),
                    conversationHistory: {value: conversation.history, onChange: conversation.onHistory},
                });
            } finally {
                await cleanupTools(toolNodes, sessionId);
            }
        }, setIsRunning);
    };

    const startConversation = (): Conversation => ({
        history: [],
        onHistory: history => change({conversationHistory: history, feedback: undefined}),
    });

    const handleRun = async () => {
        clearError();
        onResultUpdate(id);

        currentRetryRef.current = 0;

        await run(startConversation());
    };

    const feedbackLoopsLeft = () => currentRetryRef.current < maxFeedbackLoops;

    useEffect(() => {
        if (!openSettings) return;

        void fetchModels().then(fetchedModels => {
            if (isModelGone(model, fetchedModels)) change({model: ""});
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openSettings]);

    useAutoRunOnFeedbackChange({
        clearError: () => { if (feedbackLoopsLeft()) clearError(); },
        clearOutput: () => { if (feedbackLoopsLeft()) onResultUpdate(id); },
        runCallback: async () => {
            if (currentRetryRef.current++ < maxFeedbackLoops) {
                await run({
                    history: conversationHistory || [],
                    feedback,
                    onHistory: history => change({conversationHistory: feedbackLoopsLeft() ? history : [], feedback: undefined}),
                });
            }
        },
    }, [feedback]);

    useAutoRunOnInputChange({
        clearError,
        clearOutput: () => onResultUpdate(id),
        runCallback: async () => {
            currentRetryRef.current = 0;

            await run(startConversation());
        },
    }, [input]);

    useTimerTrigger(input?.timerTrigger, handleRun);

    const hasMissingConfig = !model || (models.length > 0 && !models.includes(model));

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{input: true, output: true}}
                title={title}
                run={handleRun}
                running={isRunning}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                error={error}
                extraPorts={<LlmProcessPorts id={id} />}
            />
            <LlmProcessSettings
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
                data={data}
                change={change}
                models={models}
                isFetchingModels={isFetchingModels}
                currentLoop={currentRetryRef.current}
            />
        </>
    );
}
