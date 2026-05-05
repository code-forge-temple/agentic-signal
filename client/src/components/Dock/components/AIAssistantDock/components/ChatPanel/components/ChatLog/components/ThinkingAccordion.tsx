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
};

export const ThinkingAccordion = ({thinking, isStreaming}: ThinkingAccordionProps) => {
    const [open, setOpen] = useState(true);
    const bodyRef = useRef<HTMLDivElement>(null);
    const wasStreaming = useRef(false);

    useEffect(() => {
        if (isStreaming) {
            wasStreaming.current = true;
        } else if (wasStreaming.current) {
            setOpen(false);
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
                onClick={() => setOpen(prev => !prev)}
            >
                <span className="thinking-chevron">{open ? '▾' : '▸'}</span>
                {isStreaming ? 'Thinking…' : 'Thought process'}
            </button>
            <div className={`thinking-body${open ? ' open' : ''}`} ref={bodyRef}>
                <MarkdownRenderer content={thinking} disableLoadingDelay />
            </div>
        </div>
    );
};
