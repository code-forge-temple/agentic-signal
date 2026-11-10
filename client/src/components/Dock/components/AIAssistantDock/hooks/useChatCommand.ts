/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useRef} from 'react';
import {ROLE} from '../../../../../constants';
import {NodeEnvelope} from '../../../../../types/workflow';
import {CommandError} from '../../../../../services/commandRouter';
import {CommandWorkflow, withDefaultModel} from '../../../../../workflows';
import {AI_ASSISTANT_TITLE, ChatEntry, ChatMessage} from '../constants';
import {DEFAULT_CONTEXT_WINDOW, getModelSettings, LlmSettingsMap} from '../utils/llmSettings';
import {ModelContextMap, resolveContextLimit} from '../utils/modelContext';
import {commandFailureText, commandReplySystemPrompt, commandResultsLabel, commandResultsMessage, MESSAGE_TIME_NOTE} from '../utils/chatCommands';
import {useAiLayerRun} from './useAiLayerRun';
import {ChatConversation} from './useChatConversation';


type ChatCommandOptions = {
    model: string;
    settingsMap: LlmSettingsMap;
    contextMap: ModelContextMap;
    conversation: Pick<ChatConversation, 'setMessages' | 'setIsLoading' | 'replaceReply' | 'streamReply'>;
};

/** Runs a /command's workflow on the AI Buddy layer, then has the AI Buddy answer from its results. */
export function useChatCommand ({model, settingsMap, contextMap, conversation}: ChatCommandOptions) {
    const {run, stop} = useAiLayerRun();
    const isRunningRef = useRef(false);
    const {setMessages, setIsLoading, replaceReply, streamReply} = conversation;

    // `history`: what comes before the message, the whole chat or less when a message is resent.
    const runCommand = useCallback(async (message: string, {command, description, workflow}: CommandWorkflow, text: string, history: ChatEntry[]) => {
        const userMessage: ChatMessage = {role: ROLE.USER, content: message, sentAt: Date.now()};
        const asked = [...history, userMessage];

        setMessages([...asked, {role: ROLE.ASSISTANT, content: `Running **/${command}** on the ${AI_ASSISTANT_TITLE} layer…`, runningCommand: command}]);
        setIsLoading(true);

        isRunningRef.current = true;

        let result: NodeEnvelope;

        try {
            result = await run(command, withDefaultModel(workflow, model), {payload: text});
        } catch (error) {
            setIsLoading(false);

            if (!(error instanceof CommandError && error.cancelled)) replaceReply(commandFailureText(command, error));

            return;
        } finally {
            isRunningRef.current = false;
        }

        const {limit} = resolveContextLimit(model, getModelSettings(settingsMap, model), contextMap[model]);
        const results = {label: commandResultsLabel(command), content: commandResultsMessage(command, text, result, limit ?? DEFAULT_CONTEXT_WINDOW)};

        // The reply takes the status message's place (still the last: nothing can be sent while it runs, and deleting
        // it stops the run), opening with the results folded away.
        setMessages(prev => prev.slice(0, -1));

        await streamReply(asked, commandReplySystemPrompt(command, description, text) + MESSAGE_TIME_NOTE, {role: ROLE.ASSISTANT, content: '', commandResults: results});
    }, [model, settingsMap, contextMap, run, setMessages, setIsLoading, replaceReply, streamReply]);

    /** Stops the command's run, if one is going. */
    const stopCommand = useCallback(() => {
        if (isRunningRef.current) stop();
    }, [stop]);

    return {runCommand, stopCommand};
}
