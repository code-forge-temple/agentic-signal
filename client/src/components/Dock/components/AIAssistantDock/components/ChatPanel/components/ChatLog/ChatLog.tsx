/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef} from 'react';
import {CircularProgress} from '@mui/material';
import './ChatLog.scss';
import {MarkdownRenderer} from '../../../../../../../MarkdownRenderer';
import {sanitizeJsonInput} from '../../../../../../../nodes/ToolNode/tools/utils/sanitize';
import {AI_ASSISTANT_KEYWORDS} from '../../../../../../../../constants';
import {useAutoScroll} from '../../../../../../../../hooks/useAutoScroll';
import {ThinkingAccordion} from './components/ThinkingAccordion';
import {MessageActions} from './components/MessageActions';
import {ROLE} from '../../../../../../../../constants';
import {AI_ASSISTANT_TITLE, ChatMessage} from '../../../../constants';


type ChatLogProps = {
    messages: ChatMessage[];
    isLoading: boolean;
    onLoadWorkflow: (json: string) => void;
    onDeleteMessage: (index: number) => void;
};

function extractWorkflowJson (codeString: string): string | null {
    try {
        const parsed = sanitizeJsonInput(codeString);

        if (Array.isArray(parsed.nodes)) return JSON.stringify(parsed, null, 4);

        if (parsed.workflow && Array.isArray(parsed.workflow.nodes)) return JSON.stringify(parsed.workflow, null, 4);
    } catch {
        // ignore parse failures for incomplete or malformed assistant output
    }

    return null;
}

export const ChatLog = ({messages, isLoading, onLoadWorkflow, onDeleteMessage}: ChatLogProps) => {
    const chatLogRef = useRef<HTMLDivElement>(null);
    const {updateScroll, setAutoScroll, userInterruptAutoScroll} = useAutoScroll();
    const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === ROLE.ASSISTANT;
    const showSpinner = isLoading && !lastIsAssistant;

    const renderWorkflowImportButton = useCallback(
        (codeBlock: string, isStreaming: boolean) => {
            if (isStreaming) {
                if(codeBlock.startsWith(`{`)) {
                    return (
                        <div className="import-workflow-btn-placeholder">
                            <CircularProgress size={14} className="chat-log-inline-spinner" />
                        </div>
                    );
                }

                return null;
            }

            const workflowJson = extractWorkflowJson(codeBlock);

            if (!workflowJson) return null;

            return (
                <button
                    className="import-workflow-btn"
                    type="button"
                    disabled={isStreaming}
                    onClick={() => {
                        try {
                            const sanitized = sanitizeJsonInput(codeBlock);

                            onLoadWorkflow(JSON.stringify(sanitized, null, 4));
                        } catch {
                            onLoadWorkflow(workflowJson);
                        }
                    }}
                >
                    ↳ Import to current workflow
                </button>
            );
        },
        [onLoadWorkflow]
    );

    useEffect(() => {
        if (chatLogRef.current) {
            updateScroll(chatLogRef.current);
        }
    }, [messages, updateScroll]);

    useEffect(() => {
        const currentDiv = chatLogRef.current;

        if (!currentDiv) return;

        currentDiv.addEventListener("scroll", userInterruptAutoScroll);

        return () => {
            currentDiv.removeEventListener("scroll", userInterruptAutoScroll);
        };
    }, [userInterruptAutoScroll]);

    return (
        <>
            <div className="chat-log" ref={chatLogRef}>
                <div className="chat-panel-keyword-tip chat-log-tip-row">
                    <div className="chat-panel-keyword-tip">
                        <b>TIP</b> Use:
                        <ul>
                            <li><code>{AI_ASSISTANT_KEYWORDS.PREPARE_WORKFLOW}</code> to ask the assistant to generate a workflow</li>
                            <li><code>{AI_ASSISTANT_KEYWORDS.CURRENT_WORKFLOW}</code> to reference your current workflow</li>
                            <li>
                                {/* eslint-disable-next-line max-len */}
                                For best performance, you could use one of the finetuned models from <a href="https://ollama.com/code-forge-temple" target="_blank" rel="noopener noreferrer">ollama.com/code-forge-temple</a>.
                                If that does not work, try other models with 27B parameters and up.
                            </li>
                        </ul>
                    </div>
                </div>

                {messages.length === 0 ? (
                    <p className="chat-log-empty">Start a conversation with your {AI_ASSISTANT_TITLE}.</p>
                ) : messages.map((msg, idx) => {
                    const isLastMsg = idx === messages.length - 1;
                    const isStreamingThinking = isLoading && isLastMsg && msg.role === ROLE.ASSISTANT && !!msg.thinking && !msg.content;
                    const isStreamingAssistant = isLoading && isLastMsg && msg.role === ROLE.ASSISTANT;

                    return (
                        <div key={idx} className={`chat-log-row ${msg.role}`}>
                            <MessageActions
                                onDelete={() => onDeleteMessage(idx)}
                                deleteTooltip={isLoading && isLastMsg ? 'Cancel & delete' : 'Delete message'}
                            />
                            <div className={`chat-log-message ${msg.role}`}>
                                {msg.thinking && <ThinkingAccordion thinking={msg.thinking} isStreaming={isStreamingThinking} />}
                                {msg.content && (
                                    <MarkdownRenderer
                                        content={msg.content}
                                        disableLoadingDelay
                                        codeBlockSuffix={
                                            msg.role === ROLE.ASSISTANT ?
                                                (codeBlock: string) => renderWorkflowImportButton(codeBlock, isStreamingAssistant) :
                                                undefined
                                        }
                                    />
                                )}
                                {isLoading && isLastMsg && msg.role === ROLE.ASSISTANT && !msg.content && !msg.thinking && <CircularProgress size={14} />}
                            </div>
                        </div>
                    );
                })}

                {showSpinner && <div className="chat-log-message assistant chat-log-loading"><CircularProgress size={18} /></div>}
            </div>
            <button
                className="chat-log-scroll-end"
                type="button"
                onClick={() => setAutoScroll(true)} >
                ↓
            </button>
        </>
    );
};