/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useRef, useState} from 'react';
import {MarkdownRenderer} from '../../../../../../../../MarkdownRenderer';
import './ThinkingAccordion.scss';


type ThinkingAccordionProps = {
    thinking: string;
    isStreaming: boolean;
    /** Folds other content than a thought process (a workflow's raw results) under this label. */
    label?: string;
    defaultOpen?: boolean;
};

export const ThinkingAccordion = ({thinking, isStreaming, label, defaultOpen = true}: ThinkingAccordionProps) => {
    const [open, setOpen] = useState(defaultOpen);
    // The content stays in the page only while open or closing: folded results (a /research run's) can be long,
    // and the chat keeps every reply.
    const [isClosing, setIsClosing] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);
    const wasStreaming = useRef(false);

    const close = () => {
        setOpen(false);
        setIsClosing(true);
    };

    useEffect(() => {
        if (isStreaming) {
            wasStreaming.current = true;
        } else if (wasStreaming.current) {
            setOpen(false);
            setIsClosing(true);
            wasStreaming.current = false;
        }
    }, [isStreaming]);

    useEffect(() => {
        if (open && bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    }, [thinking, open]);

    return (
        <div className="chat-log-thinking">
            <button
                className={`thinking-toggle${open ? ' open' : ''}`}
                onClick={() => (open ? close() : setOpen(true))}
            >
                <span className="thinking-chevron">{open ? '▾' : '▸'}</span>
                {label ?? (isStreaming ? 'Thinking…' : 'Thought process')}
            </button>
            <div
                className={`thinking-body${open ? ' open' : ''}`}
                ref={bodyRef}
                onTransitionEnd={(event) => {
                    if (event.target === event.currentTarget && !open) setIsClosing(false);
                }}
            >
                {(open || isClosing) && <MarkdownRenderer content={thinking} disableLoadingDelay />}
            </div>
        </div>
    );
};
