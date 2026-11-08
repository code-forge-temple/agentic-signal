/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {memo, ReactNode, useCallback} from 'react';
import {Button, CircularProgress} from '@mui/material';
import {Import} from 'iconoir-react';
import {MarkdownRenderer} from '../../../../../../../../MarkdownRenderer';
import {sanitizeJsonInput} from '../../../../../../../../nodes/ToolNode/tools/utils/sanitize';
import {ROLE} from '../../../../../../../../../constants';
import {ChatMessage} from '../../../../../constants';
import {parseCommandSuggestion} from '../../../../../utils/chatCommands';
import {findWorkflowJson} from '../../../../../utils/workflowJson';
import {ThinkingAccordion} from './ThinkingAccordion';
import {MessageActions} from './MessageActions';
import {AiLayerChip} from './AiLayerChip';


type ChatLogMessageProps = {
    message: ChatMessage;
    index: number;
    isLast: boolean;
    /** A reply or command is running and nothing came after this message: as the last one, it may be streaming. */
    busy: boolean;
    resendDisabled: boolean;
    /** The message after this one, notices aside: it tells what became of this message's suggestion. */
    nextMessage: ChatMessage | undefined;
    commandNames: string[];
    onLoadWorkflow: (json: string) => void;
    onDelete: (index: number) => void;
    onResend: (index: number) => void;
    onRunSuggestion: (message: string) => void;
    onSkipSuggestion: (index: number) => void;
};

/**
 * One message in the chat. Memoized, and its props stay the same while the message does: the chat redraws for
 * every streamed chunk and every layer switch, and generated workflows are long code blocks.
 */
export const ChatLogMessage = memo(({
    message,
    index,
    isLast,
    busy,
    resendDisabled,
    nextMessage,
    commandNames,
    onLoadWorkflow,
    onDelete,
    onResend,
    onRunSuggestion,
    onSkipSuggestion,
}: ChatLogMessageProps) => {
    const isAssistant = message.role === ROLE.ASSISTANT;
    const isStreaming = busy && isLast && isAssistant;
    const suggestionSkipped = message.suggestionSkipped;

    // A reply's `command` block as the suggestion it is: Run and Skip while nothing has been said since,
    // then what became of it. Any other block stays code (undefined).
    const renderSuggestion = useCallback((code: string, language: string | undefined): ReactNode | undefined => {
        const suggestion = parseCommandSuggestion(code, language, commandNames);

        if (!suggestion) return undefined;

        const what = <><b>/{suggestion.command}</b>{suggestion.text && `: ${suggestion.text}`}</>;

        if (suggestionSkipped) return <p className="chat-log-suggestion-done">Skipped {what}</p>;

        if (nextMessage) {
            const ran = nextMessage.role === ROLE.USER && nextMessage.content.trim() === suggestion.message;

            return <p className="chat-log-suggestion-done">{ran ? 'Ran' : 'Suggested'} {what}</p>;
        }

        return (
            <div className="chat-log-suggestion">
                <p>Run {what}?</p>
                <div className="chat-log-suggestion-actions">
                    <Button size="small" variant="contained" disabled={busy} onClick={() => onRunSuggestion(suggestion.message)}>Run</Button>
                    <Button size="small" disabled={busy} onClick={() => onSkipSuggestion(index)}>Skip</Button>
                </div>
            </div>
        );
    }, [commandNames, suggestionSkipped, nextMessage, busy, index, onRunSuggestion, onSkipSuggestion]);

    const renderImportButton = useCallback((codeBlock: string): ReactNode => {
        if (isStreaming) {
            return codeBlock.startsWith('{') ? (
                <div className="import-workflow-btn-placeholder">
                    <CircularProgress size={14} className="chat-log-inline-spinner" />
                </div>
            ) : null;
        }

        const workflowJson = findWorkflowJson(codeBlock);

        if (!workflowJson) return null;

        return (
            <button
                className="import-workflow-btn"
                type="button"
                onClick={() => {
                    try {
                        const sanitized: unknown = sanitizeJsonInput(codeBlock);

                        onLoadWorkflow(JSON.stringify(sanitized, null, 4));
                    } catch {
                        onLoadWorkflow(workflowJson);
                    }
                }}
            >
                <Import width={14} height={14} aria-hidden="true" />
                Load Workflow
            </button>
        );
    }, [isStreaming, onLoadWorkflow]);

    const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);
    const handleResend = useCallback(() => onResend(index), [onResend, index]);

    return (
        <div className={`chat-log-row ${message.role}`}>
            <MessageActions
                onDelete={handleDelete}
                deleteTooltip={busy && isLast ? 'Cancel & delete' : 'Delete message'}
                onResend={isAssistant ? undefined : handleResend}
                resendDisabled={resendDisabled}
            />
            <div className={`chat-log-message ${message.role}`}>
                {message.commandResults && (
                    <ThinkingAccordion thinking={message.commandResults.content} isStreaming={false} label={message.commandResults.label} defaultOpen={false} />
                )}
                {message.thinking && <ThinkingAccordion thinking={message.thinking} isStreaming={isStreaming && !message.content} />}
                {isAssistant && message.runningCommand ? (
                    // Drawn here, not from its Markdown text, so the layer can be a chip; the
                    // spinner is the one a reply shows while it loads.
                    <p className="chat-log-running">
                        Running <b>/{message.runningCommand}</b> on the <AiLayerChip />
                        <CircularProgress size={14} className="chat-log-running-spinner" />
                    </p>
                ) : message.content && (
                    <MarkdownRenderer
                        content={message.content}
                        disableLoadingDelay
                        codeBlockSuffix={isAssistant ? renderImportButton : undefined}
                        codeBlockRenderer={isAssistant ? renderSuggestion : undefined}
                    />
                )}
                {isStreaming && !message.content && !message.thinking && <CircularProgress size={14} />}
            </div>
        </div>
    );
});
