/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactNode} from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {MarkdownRenderer} from '../../../../../../../../MarkdownRenderer';
import {ChatMessage} from '../../../../../constants';
import {ThinkingAccordion} from './ThinkingAccordion';
import {AiLayerChip} from './AiLayerChip';


type MessageBodyProps = {
    message: ChatMessage;
    isAssistant: boolean;
    isStreaming: boolean;
    /** What follows a reply's code block: its Load Workflow button. */
    renderImportButton: (codeBlock: string) => ReactNode;
    /** A reply's command suggestion in place of its code block; undefined keeps the block. */
    renderSuggestion: (code: string, language: string | undefined) => ReactNode | undefined;
};

/** A message's text: the command a reply is running, or its Markdown (a reply's code blocks with their buttons). */
function MessageText ({message, isAssistant, renderImportButton, renderSuggestion}: Omit<MessageBodyProps, "isStreaming">) {
    if (isAssistant && message.runningCommand) {
        // Drawn here, not from its Markdown text, so the layer can be a chip; the
        // spinner is the one a reply shows while it loads.
        return (
            <p className="chat-log-running">
                Running <b>/{message.runningCommand}</b> on the <AiLayerChip />
                <CircularProgress size={14} className="chat-log-running-spinner" />
            </p>
        );
    }

    if (!message.content) return null;

    return (
        <MarkdownRenderer
            content={message.content}
            disableLoadingDelay
            codeBlockSuffix={isAssistant ? renderImportButton : undefined}
            codeBlockRenderer={isAssistant ? renderSuggestion : undefined}
        />
    );
}

/** A message's content: its command results and thinking, its text (or the command it's running), and a spinner while it starts. */
export function MessageBody ({message, isAssistant, isStreaming, renderImportButton, renderSuggestion}: MessageBodyProps) {
    return (
        <div className={`chat-log-message ${message.role}`}>
            {message.commandResults && (
                <ThinkingAccordion thinking={message.commandResults.content} isStreaming={false} label={message.commandResults.label} defaultOpen={false} />
            )}
            {message.thinking && <ThinkingAccordion thinking={message.thinking} isStreaming={isStreaming && !message.content} />}
            <MessageText message={message} isAssistant={isAssistant} renderImportButton={renderImportButton} renderSuggestion={renderSuggestion} />
            {isStreaming && !message.content && !message.thinking && <CircularProgress size={14} />}
        </div>
    );
}
