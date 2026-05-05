/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect, useRef, useCallback} from 'react';
import {ChatHeader} from './components/ChatHeader/ChatHeader';
import {ChatLog} from './components/ChatLog/ChatLog';
import {ChatInput} from './components/ChatInput/ChatInput';
import './ChatPanel.scss';
import {OllamaService} from '../../../../../../services/ollamaService';
import {buildSystemPrompt} from '../../../../../../services/buildSystemPrompt';
import {FetchAiResponseSuccess, Message, MessageRole} from '../../../../../../types/ollama.types';
import {TRIPLE_BACKTICK} from '@shared/constants';
import {DRAG_CANCEL_SELECTOR, AI_ASSISTANT_KEYWORDS, ROLE} from '../../../../../../constants';
import {ChatMessage} from '../../constants';
import {useGlobalConfig} from '../../../../../../stores/globalConfig';
import {useDraggable} from '../../../../../../hooks/useDraggable';
import {useStreamThrottle} from '../../../../../../hooks/useStreamThrottle';


const NO_MODEL = '';

type ChatPanelProps = {
    onClose: () => void;
    onLoadWorkflow: (json: string, onError?: (error: string) => void) => void;
    getWorkflowJson: () => string;
};

export const ChatPanel = ({onClose, onLoadWorkflow, getWorkflowJson}: ChatPanelProps) => {
    const {globalData, setGlobalData} = useGlobalConfig();
    const storedModel = globalData['selectedModel'] || '';

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(NO_MODEL);
    const [models, setModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const currentStreamRequestId = useRef<symbol | null>(null);

    const {
        ref: panelRef,
        position,
        onMouseDown: handleDragHandleMouseDown,
    } = useDraggable({
        initialPosition: {x: 0, y: 100},
        cancelSelector: DRAG_CANCEL_SELECTOR,
    });

    const {push, flush} = useStreamThrottle<Pick<FetchAiResponseSuccess, 'reply' | 'thinking'>>({
        delay: 500,
        onFlush: ({reply, thinking}) => {
            setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;

                if (updated[lastIndex]?.role !== ROLE.ASSISTANT) return prev;

                updated[lastIndex] = {
                    role: ROLE.ASSISTANT,
                    content: reply,
                    thinking,
                };

                return updated;
            });
        },
    });

    useEffect(() => {
        const fetchModels = async () => {
            setIsFetchingModels(true);

            const res = await OllamaService.getInstance().fetchModels();

            if (res.success) {
                const names = res.models.map(m => m.name);

                setModels(names);

                if (storedModel && names.includes(storedModel)) {
                    setSelectedModel(storedModel);
                } else {
                    setSelectedModel(NO_MODEL);

                    if (storedModel) setGlobalData('selectedModel', NO_MODEL, true);
                }
            } else {
                setSelectedModel(NO_MODEL);

                if (storedModel) setGlobalData('selectedModel', NO_MODEL, true);
            }

            setIsFetchingModels(false);
        };

        fetchModels();
    }, [storedModel, setGlobalData]);

    const handleSend = useCallback(async (text: string) => {
        if (!text || !selectedModel || isLoading) return;

        const requestId = Symbol('stream-request');

        currentStreamRequestId.current = requestId;

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
        };

        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setIsLoading(true);

        const systemMessage: Message = {
            role: MessageRole.SYSTEM,
            content: buildSystemPrompt(),
        };

        const ollamaMessages: Message[] = [
            systemMessage,
            ...updatedMessages.map(m => ({
                role: m.role as MessageRole,
                content: m.content,
            })),
        ];

        setMessages(prev => [
            ...prev,
            {role: ROLE.ASSISTANT, content: '', thinking: undefined},
        ]);

        try {
            for await (const chunk of OllamaService
                .getInstance()
                .streamAIResponse(ollamaMessages, selectedModel)
            ) {
                if (currentStreamRequestId.current !== requestId) break;

                if (chunk.success) {
                    push({
                        reply: chunk.reply,
                        thinking: chunk.thinking,
                    });
                } else {
                    if (!chunk.error?.toLowerCase().includes('aborted')) {
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastIndex = updated.length - 1;

                            if (updated[lastIndex]?.role !== ROLE.ASSISTANT) return prev;

                            updated[lastIndex] = {
                                role: ROLE.ASSISTANT,
                                content: `Error: ${chunk.error}`,
                            };

                            return updated;
                        });
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

            setIsLoading(false);
        }
    }, [messages, selectedModel, isLoading, getWorkflowJson, push, flush]);

    const handleDeleteMessage = useCallback(async (index: number) => {
        const isLastMsg = index === messages.length - 1;
        const isStreamingAssistant =
            isLoading && isLastMsg && messages[index]?.role === ROLE.ASSISTANT;

        if (isStreamingAssistant) {
            await OllamaService.getInstance().abortAIResponse();
            currentStreamRequestId.current = null;
            setIsLoading(false);
        }

        setMessages(prev => prev.filter((_, i) => i !== index));
    }, [messages, isLoading]);

    const handleModelChange = useCallback((model: string) => {
        setSelectedModel(model);
        setGlobalData('selectedModel', model, true);
    }, [setGlobalData]);

    const handleClose = useCallback(async () => {
        if (isLoading) {
            await OllamaService.getInstance().abortAIResponse();
            currentStreamRequestId.current = null;
        }

        onClose();
    }, [isLoading, onClose]);

    const handleImportWorkflow = useCallback((json: string) => {
        onLoadWorkflow(json, (error: string) => {
            handleSend(
                `The workflow JSON you generated failed to import with this error: ` +
                `${TRIPLE_BACKTICK}${error}${TRIPLE_BACKTICK}\n` +
                `Please fix the JSON and try again.`
            );
        });
    }, [onLoadWorkflow, handleSend]);

    return (
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
                onClose={handleClose}
                onMinimize={() => setIsMinimized(prev => !prev)}
                isMinimized={isMinimized}
                onDragHandleMouseDown={handleDragHandleMouseDown}
            />

            {!isMinimized && (
                <ChatLog
                    messages={messages}
                    isLoading={isLoading}
                    onLoadWorkflow={handleImportWorkflow}
                    onDeleteMessage={handleDeleteMessage}
                />
            )}

            {!isMinimized && (
                <ChatInput
                    onSend={handleSend}
                    disabled={!selectedModel || isLoading}
                    panelPosition={position}
                />
            )}
        </div>
    );
};