/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {ChatHeader} from './components/ChatHeader/ChatHeader';
import {ChatLog} from './components/ChatLog/ChatLog';
import {ChatInput} from './components/ChatInput/ChatInput';
import './ChatPanel.scss';
import {OllamaService} from '../../../../../../services/ollamaService';
import {buildSystemPrompt} from '../../../../../../services/buildSystemPrompt';
import {FetchAiResponseSuccess, Message, MessageRole} from '../../../../../../types/ollama.types';
import {TRIPLE_BACKTICK} from '@shared/constants';
import {DRAG_CANCEL_SELECTOR, AI_ASSISTANT_KEYWORDS, ROLE} from '../../../../../../constants';
import {AI_ASSISTANT_TITLE, ChatEntry, ChatMessage, ChatNotice, ContextUsage, EMPTY_CONTEXT_USAGE, NOTICE_ROLE} from '../../constants';
import {useGlobalConfig} from '../../../../../../stores/globalConfig';
import {useDraggable} from '../../../../../../hooks/useDraggable';
import {useStreamThrottle} from '../../../../../../hooks/useStreamThrottle';
import {useFetchModels} from '../../../../../../hooks/useFetchModels';
import {LlmSettingsDialog} from './components/ChatHeader/components/LlmSettingsDialog';
import {useLlmSettings} from '../../hooks/useLlmSettings';
import {DEFAULT_CONTEXT_WINDOW, getModelSettings} from '../../utils/llmSettings';
import {contextWindowWarning, isCloudModel, minimumContextWindow, resolveContextLimit} from '../../utils/modelContext';
import {withModelSwitch} from '../../utils/modelSwitch';
import {useSnackbar} from 'notistack';
import {NodeEnvelope} from '../../../../../../types/workflow';
import {CommandError} from '../../../../../../services/commandRouter';
import {CommandWorkflow, withDefaultModel} from '../../../../../../workflows';
import {useCommandWorkflows} from '../../../../../../hooks/useCommandWorkflows';
import {useAiLayerRun} from '../../hooks/useAiLayerRun';
import {
    chatCommandsPrompt,
    commandFailureText,
    commandReplySystemPrompt,
    commandResultsLabel,
    commandResultsMessage,
    MESSAGE_TIME_NOTE,
    parseCommandMessage,
    toModelMessages,
} from '../../utils/chatCommands';


const NO_MODEL = '';

// eslint-disable-next-line max-len
const unknownCommandText = (command: string) => `Unknown command /${command}. Save a workflow that answers to it to your workflows folder, or type / to see the commands you can run.`;

type ChatPanelProps = {
    onClose: () => void;
    onLoadWorkflow: (json: string, onError?: (error: string) => void) => void;
    getWorkflowJson: () => string;
};

export const ChatPanel = ({onClose, onLoadWorkflow, getWorkflowJson}: ChatPanelProps) => {
    const {enqueueSnackbar} = useSnackbar();
    const {globalData, setGlobalData} = useGlobalConfig();
    const storedModel = globalData['selectedModel'] || '';

    const [messages, setMessages] = useState<ChatEntry[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(NO_MODEL);
    const {models, isFetchingModels, fetchModels} = useFetchModels();
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [contextUsage, setContextUsage] = useState<ContextUsage>(EMPTY_CONTEXT_USAGE);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const {settingsMap, contextMap} = useLlmSettings();

    const currentStreamRequestId = useRef<symbol | null>(null);
    // The reply in flight, cancellable on its own: an LLM node running in some layer is left alone.
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortControllerRef.current?.abort(), []);

    const {run: runOnAiLayer, stop: stopAiLayerRun} = useAiLayerRun();
    const commandWorkflows = useCommandWorkflows();
    // What the instructions and a reply need, measured on the instructions themselves (they grow with every
    // node and tool): shown in the tip, and checked against the selected model's window.
    const minimumContext = useMemo(() => minimumContextWindow(buildSystemPrompt()), []);
    const chatCommands = useMemo(() => commandWorkflows.map(w => ({value: `/${w.command}`, description: w.description})), [commandWorkflows]);
    const isRunningCommandRef = useRef(false);

    const {
        ref: panelRef,
        position,
        onMouseDown: handleDragHandleMouseDown,
    } = useDraggable({
        initialPosition: {x: 0, y: 100},
        cancelSelector: DRAG_CANCEL_SELECTOR,
    });

    const {push, flush, cancel} = useStreamThrottle<Pick<FetchAiResponseSuccess, 'reply' | 'thinking'>>({
        delay: 500,
        onFlush: ({reply, thinking}) => {
            setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                const last = updated[lastIndex];

                if (last?.role !== ROLE.ASSISTANT) return prev;

                updated[lastIndex] = {
                    ...last,
                    content: reply,
                    thinking,
                };

                return updated;
            });
        },
    });

    // The saved model, if Ollama still has it; otherwise none, and the saved choice is cleared.
    useEffect(() => {
        void fetchModels().then((names) => {
            if (storedModel && names.includes(storedModel)) return setSelectedModel(storedModel);

            setSelectedModel(NO_MODEL);

            if (storedModel) setGlobalData('selectedModel', NO_MODEL, true);
        });
    }, [storedModel, setGlobalData, fetchModels]);

    const setLastAssistantMessage = useCallback((content: string) => {
        setMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            const last = updated[lastIndex];

            if (last?.role !== ROLE.ASSISTANT) return prev;

            // An error in a command's reply keeps the results it was answering from.
            updated[lastIndex] = {role: ROLE.ASSISTANT, content, commandResults: last.commandResults};

            return updated;
        });
    }, []);

    // Streams the AI Buddy's reply to `conversation` (already on screen) into `reply`, added after it.
    const streamReply = useCallback(async (
        conversation: ChatEntry[],
        systemPrompt: string,
        reply: ChatMessage = {role: ROLE.ASSISTANT, content: ''}
    ) => {
        const requestId = Symbol('stream-request');

        currentStreamRequestId.current = requestId;

        const controller = new AbortController();

        abortControllerRef.current = controller;

        // Nothing buffered from a previous stream may survive into this one.
        cancel();

        setIsLoading(true);

        const ollamaMessages: Message[] = [
            {role: MessageRole.SYSTEM, content: systemPrompt},
            ...toModelMessages([...conversation, reply]),
        ];

        setMessages(prev => [...prev, reply]);

        try {
            const modelSettings = getModelSettings(settingsMap, selectedModel);
            // LlmSettings and StreamChatOptions are structurally identical — absent means
            // "don't override" on both sides — so this is otherwise a straight pass-through.
            // contextWindow is dropped for cloud models: Ollama Cloud ignores num_ctx anyway
            // (ollama/ollama#16598), and sending it would suggest it had taken effect.
            const streamOptions = isCloudModel(selectedModel)
                ? {...modelSettings, contextWindow: undefined}
                : modelSettings;

            for await (const chunk of OllamaService
                .getInstance()
                .streamAIResponse(ollamaMessages, selectedModel, streamOptions, controller.signal)
            ) {
                if (currentStreamRequestId.current !== requestId) {
                    cancel();

                    break;
                }

                if (chunk.success) {
                    push({
                        reply: chunk.reply,
                        thinking: chunk.thinking,
                    });

                    if (chunk.final) {
                        // Falling back to empty when NEITHER count arrived: an Ollama build that
                        // doesn't report them would otherwise leave the previous reading in place,
                        // looking like a freshly measured one.
                        setContextUsage(
                            chunk.promptEvalCount === undefined && chunk.evalCount === undefined
                                ? EMPTY_CONTEXT_USAGE
                                : {
                                    model: selectedModel,
                                    promptTokens: chunk.promptEvalCount ?? 0,
                                    replyTokens: chunk.evalCount ?? 0,
                                }
                        );
                    }
                } else {
                    // Drop the buffered partial first: otherwise the flush() below repaints it
                    // over the error message written here.
                    cancel();

                    if (!chunk.error?.toLowerCase().includes('aborted')) {
                        setLastAssistantMessage(`Error: ${chunk.error}`);
                    }

                    break;
                }
            }

            flush();
        } catch {
            // ignore abort
        } finally {
            if (currentStreamRequestId.current === requestId) {
                currentStreamRequestId.current = null;
            }

            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }

            setIsLoading(false);
        }
    }, [selectedModel, push, flush, cancel, settingsMap, setLastAssistantMessage]);

    const respond = useCallback(async (conversation: ChatEntry[]) => {
        setMessages(conversation);

        const commandsSection = commandWorkflows.length > 0 ? chatCommandsPrompt(commandWorkflows) : '';

        await streamReply(conversation, buildSystemPrompt() + commandsSection + MESSAGE_TIME_NOTE);
    }, [commandWorkflows, streamReply]);

    const handleSend = useCallback(async (text: string) => {
        if (!text || !selectedModel || isLoading) return;

        const processedText = text.replace(
            new RegExp(AI_ASSISTANT_KEYWORDS.CURRENT_WORKFLOW, 'g'),
            () => {
                const json = getWorkflowJson();

                return `current workflow:\n\n${TRIPLE_BACKTICK}json\n${json}\n${TRIPLE_BACKTICK}\n`;
            }
        );

        const userMessage: ChatMessage = {
            role: ROLE.USER,
            content: processedText,
            sentAt: Date.now(),
        };

        await respond([...messages, userMessage]);
    }, [messages, selectedModel, isLoading, getWorkflowJson, respond]);

    // `history`: what comes before the message, the whole chat or less when a message is resent.
    const handleCommand = useCallback(async (message: string, commandWorkflow: CommandWorkflow, text: string, history: ChatEntry[] = messages) => {
        if (!selectedModel || isLoading) return;

        const {command, description, workflow} = commandWorkflow;
        const userMessage: ChatMessage = {role: ROLE.USER, content: message, sentAt: Date.now()};
        const conversation = [...history, userMessage];

        setMessages([...conversation, {role: ROLE.ASSISTANT, content: `Running **/${command}** on the ${AI_ASSISTANT_TITLE} layer…`, runningCommand: command}]);
        setIsLoading(true);

        isRunningCommandRef.current = true;

        let result: NodeEnvelope;

        try {
            result = await runOnAiLayer(command, withDefaultModel(workflow, selectedModel), {payload: text});
        } catch (error) {
            setIsLoading(false);

            if (error instanceof CommandError && error.cancelled) return;

            setLastAssistantMessage(commandFailureText(command, error));

            return;
        } finally {
            isRunningCommandRef.current = false;
        }

        const {limit} = resolveContextLimit(selectedModel, getModelSettings(settingsMap, selectedModel), contextMap[selectedModel]);
        const reply: ChatMessage = {
            role: ROLE.ASSISTANT,
            content: '',
            commandResults: {
                label: commandResultsLabel(command),
                content: commandResultsMessage(command, text, result, limit ?? DEFAULT_CONTEXT_WINDOW),
            },
        };

        // The reply takes the status message's place (still the last: nothing can be sent while it runs,
        // and deleting it stops the run), opening with the results folded away.
        setMessages(prev => prev.slice(0, -1));

        await streamReply(conversation, commandReplySystemPrompt(command, description, text) + MESSAGE_TIME_NOTE, reply);
    }, [messages, selectedModel, isLoading, runOnAiLayer, setLastAssistantMessage, settingsMap, contextMap, streamReply]);

    const handleSubmit = useCallback((text: string): boolean => {
        const commandMessage = parseCommandMessage(text);

        if (commandMessage) {
            const commandWorkflow = commandWorkflows.find(w => w.command === commandMessage.command);

            if (!commandWorkflow) {
                enqueueSnackbar(unknownCommandText(commandMessage.command), {variant: 'warning'});

                return false;
            }

            void handleCommand(text, commandWorkflow, commandMessage.text);

            return true;
        }

        void handleSend(text);

        return true;
    }, [enqueueSnackbar, handleSend, handleCommand, commandWorkflows]);

    // Running a command the AI Buddy suggested: as if the user had typed it, so it's their message in the chat.
    const handleRunSuggestion = useCallback((message: string) => {
        if (!isLoading) handleSubmit(message);
    }, [isLoading, handleSubmit]);

    const handleResendMessage = useCallback((index: number) => {
        const message = messages[index];

        if (message?.role !== ROLE.USER || !selectedModel || isLoading) return;

        const commandMessage = parseCommandMessage(message.content);
        const commandWorkflow = commandMessage && commandWorkflows.find(w => w.command === commandMessage.command);

        if (commandMessage && !commandWorkflow) {
            enqueueSnackbar(unknownCommandText(commandMessage.command), {variant: 'warning'});

            return;
        }

        // A model switch among the dropped entries still holds: it's redrawn before the resent message.
        const firstSwitch = messages.slice(index + 1).find((entry): entry is ChatNotice => entry.role === NOTICE_ROLE);
        const history: ChatEntry[] = firstSwitch && firstSwitch.previousModel !== selectedModel
            ? withModelSwitch(messages.slice(0, index), selectedModel, firstSwitch.previousModel)
            : messages.slice(0, index);

        // The old count would read high until the new reply measures it.
        setContextUsage(EMPTY_CONTEXT_USAGE);

        if (commandMessage && commandWorkflow) void handleCommand(message.content, commandWorkflow, commandMessage.text, history);
        else void respond([...history, {...message, sentAt: Date.now()}]);
    }, [messages, selectedModel, isLoading, commandWorkflows, enqueueSnackbar, handleCommand, respond]);

    const handleSkipSuggestion = useCallback((index: number) => {
        setMessages(prev => prev.map((message, i) => i === index && message.role === ROLE.ASSISTANT ? {...message, suggestionSkipped: true} : message));
    }, []);

    const handleDeleteMessage = useCallback((index: number) => {
        const isLastMsg = index === messages.length - 1;
        const isStreamingAssistant =
            isLoading && isLastMsg && messages[index]?.role === ROLE.ASSISTANT;

        if (isStreamingAssistant) {
            abortControllerRef.current?.abort();
            currentStreamRequestId.current = null;
            setIsLoading(false);

            // The message is a command's status line: deleting it stops the run.
            if (isRunningCommandRef.current) stopAiLayerRun();
        }

        // Before the state update, so a buffered chunk can't land in the gap and repaint
        // the message that is being removed.
        cancel();

        setMessages(prev => prev.filter((_, i) => i !== index));

        // The old count would now read high, and nothing re-measures until the next send.
        setContextUsage(EMPTY_CONTEXT_USAGE);
    }, [messages, isLoading, cancel, stopAiLayerRun]);

    const handleModelChange = useCallback((model: string) => {
        setSelectedModel(model);
        setGlobalData('selectedModel', model, true);

        setMessages(prev => withModelSwitch(prev, model, selectedModel));
    }, [setGlobalData, selectedModel]);

    const handleClose = useCallback(() => {
        if (isLoading) {
            abortControllerRef.current?.abort();
            currentStreamRequestId.current = null;
        }

        if (isRunningCommandRef.current) stopAiLayerRun();

        onClose();
    }, [isLoading, onClose, stopAiLayerRun]);

    // Into whichever layer is shown when the button is pressed; the AI Buddy layer offers a new layer instead.
    const handleImportWorkflow = useCallback((json: string) => {
        onLoadWorkflow(json, (error: string) => {
            void handleSend(
                `The workflow JSON you generated failed to import with this error: ` +
                `${TRIPLE_BACKTICK}${error}${TRIPLE_BACKTICK}\n` +
                `Please fix the JSON and try again.`
            );
        });
    }, [onLoadWorkflow, handleSend]);

    const resolvedContext = resolveContextLimit(
        selectedModel,
        getModelSettings(settingsMap, selectedModel),
        contextMap[selectedModel]
    );
    const {limit, source} = resolvedContext;
    const contextWarning = contextWindowWarning(selectedModel, resolvedContext, minimumContext);
    // Token counts aren't comparable across tokenizers, so a reading only counts while the
    // model that produced it is still selected.
    const usedTokens = contextUsage.model === selectedModel
        ? contextUsage.promptTokens + contextUsage.replyTokens
        : 0;

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
                            usedTokens,
                            contextLimit: limit,
                            limitSource: source,
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