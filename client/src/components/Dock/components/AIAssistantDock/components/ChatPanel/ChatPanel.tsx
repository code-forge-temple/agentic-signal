/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useCallback, useMemo} from 'react';
import {ChatHeader} from './components/ChatHeader/ChatHeader';
import {ChatLog} from './components/ChatLog/ChatLog';
import {ChatInput} from './components/ChatInput/ChatInput';
import './ChatPanel.scss';
import {buildSystemPrompt} from '../../../../../../services/buildSystemPrompt';
import {DRAG_CANCEL_SELECTOR, ROLE} from '../../../../../../constants';
import {ChatEntry, EMPTY_CONTEXT_USAGE} from '../../constants';
import {useDraggable} from '../../../../../../hooks/useDraggable';
import {LlmSettingsDialog} from './components/ChatHeader/components/LlmSettingsDialog';
import {useLlmSettings} from '../../hooks/useLlmSettings';
import {getModelSettings} from '../../utils/llmSettings';
import {contextWindowWarning, minimumContextWindow, resolveContextLimit} from '../../utils/modelContext';
import {withModelSwitch} from '../../utils/modelSwitch';
import {useSnackbar} from 'notistack';
import {CommandWorkflow} from '../../../../../../workflows';
import {useCommandWorkflows} from '../../../../../../hooks/useCommandWorkflows';
import {chatCommandsPrompt, MESSAGE_TIME_NOTE, resolveCommand} from '../../utils/chatCommands';
import {historyBefore, importFailureMessage, usedTokens, withCurrentWorkflow} from '../../utils/chatEntries';
import {useChatModel} from '../../hooks/useChatModel';
import {useChatConversation} from '../../hooks/useChatConversation';
import {useChatCommand} from '../../hooks/useChatCommand';


// eslint-disable-next-line max-len
const unknownCommandText = (command: string) => `Unknown command /${command}. Save a workflow that answers to it to your workflows folder, or type / to see the commands you can run.`;

type ChatPanelProps = {
    onClose: () => void;
    onLoadWorkflow: (json: string, onError?: (error: string) => void) => void;
    getWorkflowJson: () => string;
};

export const ChatPanel = ({onClose, onLoadWorkflow, getWorkflowJson}: ChatPanelProps) => {
    const {enqueueSnackbar} = useSnackbar();
    const [isMinimized, setIsMinimized] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const {settingsMap, contextMap} = useLlmSettings();
    const {selectedModel, models, isFetchingModels, chooseModel} = useChatModel();
    const conversation = useChatConversation({model: selectedModel, settingsMap});
    const {messages, setMessages, isLoading, setIsLoading, contextUsage, setContextUsage, streamReply, stopReply, dropBuffered} = conversation;
    const {runCommand, stopCommand} = useChatCommand({model: selectedModel, settingsMap, contextMap, conversation});
    const commandWorkflows = useCommandWorkflows();
    // What the instructions and a reply need, measured on the instructions themselves (they grow with every
    // node and tool): shown in the tip, and checked against the selected model's window.
    const minimumContext = useMemo(() => minimumContextWindow(buildSystemPrompt()), []);
    const chatCommands = useMemo(() => commandWorkflows.map(w => ({value: `/${w.command}`, description: w.description})), [commandWorkflows]);

    const {ref: panelRef, position, onMouseDown: handleDragHandleMouseDown} = useDraggable({initialPosition: {x: 0, y: 100}, cancelSelector: DRAG_CANCEL_SELECTOR});

    const warnUnknownCommand = useCallback((command: string) => {
        enqueueSnackbar(unknownCommandText(command), {variant: 'warning'});
    }, [enqueueSnackbar]);

    const respond = useCallback(async (entries: ChatEntry[]) => {
        setMessages(entries);

        const commandsSection = commandWorkflows.length > 0 ? chatCommandsPrompt(commandWorkflows) : '';

        await streamReply(entries, buildSystemPrompt() + commandsSection + MESSAGE_TIME_NOTE);
    }, [commandWorkflows, streamReply, setMessages]);

    const handleSend = useCallback(async (text: string) => {
        if (!text || !selectedModel || isLoading) return;

        await respond([...messages, {role: ROLE.USER, content: withCurrentWorkflow(text, getWorkflowJson), sentAt: Date.now()}]);
    }, [messages, selectedModel, isLoading, getWorkflowJson, respond]);

    // `history`: what comes before the message, the whole chat or less when a message is resent.
    const handleCommand = useCallback((message: string, commandWorkflow: CommandWorkflow, text: string, history: ChatEntry[] = messages) => {
        if (selectedModel && !isLoading) void runCommand(message, commandWorkflow, text, history);
    }, [messages, selectedModel, isLoading, runCommand]);

    const handleSubmit = useCallback((text: string): boolean => {
        const command = resolveCommand(text, commandWorkflows);

        if (!command) {
            void handleSend(text);

            return true;
        }

        if (!command.workflow) {
            warnUnknownCommand(command.command);

            return false;
        }

        handleCommand(text, command.workflow, command.text);

        return true;
    }, [commandWorkflows, handleSend, warnUnknownCommand, handleCommand]);

    // Running a command the AI Buddy suggested: as if the user had typed it, so it's their message in the chat.
    const handleRunSuggestion = useCallback((message: string) => {
        if (!isLoading) handleSubmit(message);
    }, [isLoading, handleSubmit]);

    const handleResendMessage = useCallback((index: number) => {
        const message = messages[index];

        if (message?.role !== ROLE.USER || !selectedModel || isLoading) return;

        const command = resolveCommand(message.content, commandWorkflows);

        if (command && !command.workflow) {
            warnUnknownCommand(command.command);

            return;
        }

        const history = historyBefore(messages, index, selectedModel);

        // The old count would read high until the new reply measures it.
        setContextUsage(EMPTY_CONTEXT_USAGE);

        if (command?.workflow) handleCommand(message.content, command.workflow, command.text, history);
        else void respond([...history, {...message, sentAt: Date.now()}]);
    }, [messages, selectedModel, isLoading, commandWorkflows, warnUnknownCommand, setContextUsage, handleCommand, respond]);

    const handleSkipSuggestion = useCallback((index: number) => {
        setMessages(prev => prev.map((message, i) => i === index && message.role === ROLE.ASSISTANT ? {...message, suggestionSkipped: true} : message));
    }, [setMessages]);

    const handleDeleteMessage = useCallback((index: number) => {
        // The reply still streaming stops, and so does the run of a command whose status line it is.
        if (isLoading && index === messages.length - 1 && messages[index]?.role === ROLE.ASSISTANT) {
            stopReply();
            setIsLoading(false);
            stopCommand();
        }

        // Before the state update, so a buffered chunk can't land in the gap and repaint
        // the message that is being removed.
        dropBuffered();

        setMessages(prev => prev.filter((_, i) => i !== index));

        // The old count would now read high, and nothing re-measures until the next send.
        setContextUsage(EMPTY_CONTEXT_USAGE);
    }, [messages, isLoading, stopReply, setIsLoading, stopCommand, dropBuffered, setMessages, setContextUsage]);

    const handleModelChange = useCallback((model: string) => {
        chooseModel(model);
        setMessages(prev => withModelSwitch(prev, model, selectedModel));
    }, [chooseModel, setMessages, selectedModel]);

    const handleClose = useCallback(() => {
        if (isLoading) stopReply();

        stopCommand();
        onClose();
    }, [isLoading, stopReply, stopCommand, onClose]);

    // Into whichever layer is shown when the button is pressed; the AI Buddy layer offers a new layer instead.
    const handleImportWorkflow = useCallback((json: string) => {
        onLoadWorkflow(json, (error: string) => {
            void handleSend(importFailureMessage(error));
        });
    }, [onLoadWorkflow, handleSend]);

    const resolvedContext = resolveContextLimit(selectedModel, getModelSettings(settingsMap, selectedModel), contextMap[selectedModel]);
    const contextWarning = contextWindowWarning(selectedModel, resolvedContext, minimumContext);

    return (
        <>
            <div
                ref={panelRef}
                className={`chat-panel${isMinimized ? ' minimized' : ''}`}
                onMouseDown={handleDragHandleMouseDown}
            >
                <ChatHeader
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    models={models}
                    isFetchingModels={isFetchingModels}
                    // A reply or command in flight keeps the model it started with; a switch then would land mid-reply.
                    isModelLocked={isLoading}
                    contextWarning={contextWarning}
                    onClose={handleClose}
                    onMinimize={() => setIsMinimized(prev => !prev)}
                    isMinimized={isMinimized}
                    onDragHandleMouseDown={handleDragHandleMouseDown}
                    onOpenSettings={() => setSettingsOpen(true)}
                />

                {!isMinimized && (
                    <ChatLog
                        messages={messages}
                        minimumContext={minimumContext}
                        isLoading={isLoading}
                        onLoadWorkflow={handleImportWorkflow}
                        onDeleteMessage={handleDeleteMessage}
                        onResendMessage={handleResendMessage}
                        commands={commandWorkflows}
                        onRunSuggestion={handleRunSuggestion}
                        onSkipSuggestion={handleSkipSuggestion}
                    />
                )}

                {!isMinimized && (
                    <ChatInput
                        onSend={handleSubmit}
                        commands={chatCommands}
                        disabled={!selectedModel || isLoading}
                        panelPosition={position}
                        contextGauge={{
                            usedTokens: usedTokens(contextUsage, selectedModel),
                            contextLimit: resolvedContext.limit,
                            limitSource: resolvedContext.source,
                            hasModel: !!selectedModel,
                        }}
                    />
                )}
            </div>

            {/*
              * Sibling of the panel, not a child: React events bubble through the React tree
              * even though the dialog is portaled out of the panel in the DOM, so nesting it
              * would feed its mousedowns to the panel's drag handler and drag the chat box
              * around whenever the dialog is dragged.
              */}
            <LlmSettingsDialog
                open={settingsOpen}
                model={selectedModel}
                onClose={() => setSettingsOpen(false)}
            />
        </>
    );
};
