/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useEffect, useRef} from 'react';
import './ChatInputSuggestions.scss';


type Size = {
    width: number;
    height: number;
}

type ChatInputSuggestionsProps = {
    suggestions: string[];
    position: { top: number; left: number };
    onSuggestionClick: (option: string) => void;
    selectedIndex: number;
    onSuggestionHover: (index: number) => void;
    getMenuSize?: (size: Size | ((prev: Size) => Size)) => void;
};

export const ChatInputSuggestions: React.FC<ChatInputSuggestionsProps> = ({
    suggestions,
    position,
    selectedIndex,
    onSuggestionClick,
    onSuggestionHover,
    getMenuSize,
}) => {
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (!listRef.current || !getMenuSize) return;

        const el = listRef.current;
        let prev = {width: 0, height: 0};
        const updateSize = () => {
            const rect = el.getBoundingClientRect();

            if (rect.width !== prev.width || rect.height !== prev.height) {
                prev = {width: rect.width, height: rect.height};
                getMenuSize(prev);
            }
        };

        updateSize();

        const resizeObserver = new window.ResizeObserver(updateSize);

        resizeObserver.observe(el);

        return () => resizeObserver.disconnect();
    }, [getMenuSize, suggestions.length]);

    return (
        <ul
            ref={listRef}
            className="chat-input-suggestions"
            style={{
                top: position.top,
                left: position.left,
                position: 'fixed',
            }}
        >
            {suggestions.map((option, index) => (
                <li
                    className={'chat-input-suggestion' + (index === selectedIndex ? ' selected' : '')}
                    key={option}
                    onClick={() => onSuggestionClick(option)}
                    onMouseEnter={() => onSuggestionHover(index)} >
                    {option}
                </li>
            ))}
        </ul>
    );
}
