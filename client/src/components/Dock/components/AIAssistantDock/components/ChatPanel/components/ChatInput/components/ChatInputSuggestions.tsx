/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import './ChatInputSuggestions.scss';


type Size = {
    width: number;
    height: number;
}

/** An entry in the menu: what gets typed, and optionally what it does (a command's description). */
export type Suggestion = {
    value: string;
    description?: string;
};

type ChatInputSuggestionsProps = {
    suggestions: Suggestion[];
    position: { top: number; left: number };
    onSuggestionClick: (option: string) => void;
    selectedIndex: number;
    onSuggestionHover: (index: number) => void;
    getMenuSize?: (size: Size | ((prev: Size) => Size)) => void;
};

export const ChatInputSuggestions = ({
    suggestions,
    position,
    selectedIndex,
    onSuggestionClick,
    onSuggestionHover,
    getMenuSize,
}: ChatInputSuggestionsProps) => {
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

    // Rendered into the body: the dock around the chat is moved with a transform, and a fixed element
    // inside it would be placed from the dock's corner instead of the window's.
    return createPortal(
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
                    key={option.value}
                    onClick={() => onSuggestionClick(option.value)}
                    onMouseEnter={() => onSuggestionHover(index)} >
                    <span className="chat-input-suggestion-value">{option.value}</span>
                    {option.description && (
                        // Cut off when long; hovering shows all of it.
                        <span className="chat-input-suggestion-description" title={option.description}>{option.description}</span>
                    )}
                </li>
            ))}
        </ul>,
        document.body
    );
}
