/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useMemo, useRef} from 'react';
import {CircularProgress} from '@mui/material';
import './ChatLog.scss';
import {AI_ASSISTANT_KEYWORDS} from '../../../../../../../../constants';
import {useAutoScroll} from '../../../../../../../../hooks/useAutoScroll';
import {useLatestValue} from '../../../../../../../../hooks/useLatestValue';
import {ChatLogMessage} from './components/ChatLogMessage';
import {ROLE} from '../../../../../../../../constants';
import {AI_ASSISTANT_TITLE, ChatEntry, ChatMessage, NOTICE_ROLE} from '../../../../constants';

type ChatLogProps = {
    messages: ChatEntry[];
    /** The smallest context window the AI Buddy works in, in tokens: named in the tip. */
    minimumContext: number;
    isLoading: boolean;
    onLoadWorkflow: (json: string) => void;
    onDeleteMessage: (index: number) => void;
    /** The commands the chat can run: a reply's `command` block naming one of them is a suggestion. */
    commands: {command: string}[];
    /** Runs a suggested command, `/research …`, as the user's own message. */
    onRunSuggestion: (message: string) => void;
    onSkipSuggestion: (index: number) => void;
};

export const ChatLog = ({messages, minimumContext, isLoading, onLoadWorkflow, onDeleteMessage, commands, onRunSuggestion, onSkipSuggestion}: ChatLogProps) => {
    const chatLogRef = useRef<HTMLDivElement>(null);
    const {updateScroll, setAutoScroll, userInterruptAutoScroll} = useAutoScroll();
    const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === ROLE.ASSISTANT;
    const showSpinner = isLoading && !lastIsAssistant;
    const commandNames = useMemo(() => commands.map(c => c.command), [commands]);

    // The same functions on every redraw, so the messages' memo holds: the chat panel's own callbacks change with
    // every streamed chunk and every layer switch. Each calls the newest one.
    const latest = useLatestValue({onLoadWorkflow, onDeleteMessage, onRunSuggestion, onSkipSuggestion});
    const loadWorkflow = useCallback((json: string) => latest.current.onLoadWorkflow(json), [latest]);
    const deleteMessage = useCallback((index: number) => latest.current.onDeleteMessage(index), [latest]);
    const runSuggestion = useCallback((message: string) => latest.current.onRunSuggestion(message), [latest]);
    const skipSuggestion = useCallback((index: number) => latest.current.onSkipSuggestion(index), [latest]);

    // Each message's next one, notices aside.
    const nextMessages = useMemo(() => {
        const next: (ChatMessage | undefined)[] = [];
        let after: ChatMessage | undefined;

        for (let i = messages.length - 1; i >= 0; i--) {
            next[i] = after;

            const entry = messages[i];

            if (entry.role !== NOTICE_ROLE) after = entry;
        }

        return next;
    }, [messages]);

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
                            <li><code>{"/<command>"}</code> to run a saved workflow on the assistant&apos;s own layer, e.g. <code>/research &lt;topic&gt;</code></li>
                            <li>
                                For minimal performance, try models with 27B parameters and up, and a context window of at least {minimumContext / 1024}K tokens.
                            </li>
                        </ul>
                    </div>
                </div>

                {messages.length === 0 ? (
                    <p className="chat-log-empty">Start a conversation with your {AI_ASSISTANT_TITLE}.</p>
                ) : messages.map((msg, idx) => {
                    // Where the model was switched: a line, not a message.
                    if (msg.role === NOTICE_ROLE) {
                        return (
                            <div key={idx} className="chat-log-notice" role="note">
                                <span>Model changed to <b>{msg.model}</b></span>
                            </div>
                        );
                    }

                    const nextMessage = nextMessages[idx];

                    return (
                        <ChatLogMessage
                            key={idx}
                            message={msg}
                            index={idx}
                            isLast={idx === messages.length - 1}
                            busy={isLoading && nextMessage === undefined}
                            nextMessage={nextMessage}
                            commandNames={commandNames}
                            onLoadWorkflow={loadWorkflow}
                            onDelete={deleteMessage}
                            onRunSuggestion={runSuggestion}
                            onSkipSuggestion={skipSuggestion}
                        />
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
