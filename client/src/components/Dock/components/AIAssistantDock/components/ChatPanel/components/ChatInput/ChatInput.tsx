/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect, useRef, useLayoutEffect, useCallback} from 'react';
import {IconButton} from '@mui/material';
import {SendDiagonal} from 'iconoir-react';
import './ChatInput.scss';
import {ChatInputSuggestions} from './components/ChatInputSuggestions';


type ChatInputProps = {
    onSend: (text: string) => void;
    disabled: boolean;
    panelPosition?: { x: number; y: number };
};

const SUGGESTIONS = ['@prepare-workflow', '@current-workflow'];

export const ChatInput = ({onSend, disabled, panelPosition}: ChatInputProps) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const prevDisabled = useRef(disabled);
    const [caret, setCaret] = useState<number>(0);
    const [suggestionsVisible, setSuggestionsVisible] = useState(false);
    const [suggestionPosition, setSuggestionPosition] = useState({top: 0, left: 0});
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [menuSize, setMenuSize] = useState({width: 0, height: 0});

    useEffect(() => {
        if (prevDisabled.current && !disabled) {
            inputRef.current?.focus();
        }

        prevDisabled.current = disabled;
    }, [disabled]);

    useLayoutEffect(() => {
        if (inputRef.current && suggestionsVisible) {
            const input = inputRef.current;
            const rect = input.getBoundingClientRect();
            const textUpToCaret = value.slice(0, caret);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let caretPixelPos = 0;
            let inputPaddingLeft = 0;

            if (ctx) {
                const computedStyle = window.getComputedStyle(input);

                inputPaddingLeft = parseInt(computedStyle.paddingLeft || '0', 10);
                ctx.font = computedStyle.font;
                caretPixelPos = ctx.measureText(textUpToCaret).width;
            }

            const panelX = panelPosition?.x || 0;

            setSuggestionPosition({
                top: rect.top,
                left: window.scrollX + caretPixelPos - (input.scrollLeft || 0) + inputPaddingLeft + menuSize.width + panelX
            });
        }
    }, [suggestionsVisible, value, caret, menuSize, panelPosition]);

    useEffect(() => {
        const textUpToCaret = value.slice(0, caret);
        const lastWord = textUpToCaret.split(/\s/).pop() || '';

        if (lastWord.startsWith('@')) {
            setSuggestionsVisible(true);
            setSelectedSuggestionIndex(0);
        } else {
            setSuggestionsVisible(false);
        }
    }, [value, caret]);

    const handleSend = useCallback(() => {
        if (!value.trim() || disabled) return;

        onSend(value.trim());
        setValue('');
        setSuggestionsVisible(false);
    }, [disabled, onSend, value]);

    const handleSuggestionClick = useCallback((option: string) => {
        const textUpToCaret = value.slice(0, caret);
        const restText = value.slice(caret);
        const words = textUpToCaret.split(/\s/);

        words[words.length - 1] = option;

        const newText = words.join(' ') + ' ' + restText;
        const newCaret = words.join(' ').length + 1;

        setValue(newText);
        setCaret(newCaret);
        setSuggestionsVisible(false);

        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    }, [value, caret]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (suggestionsVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();

                setSelectedSuggestionIndex((prev) => (prev + 1) % SUGGESTIONS.length);

                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();

                setSelectedSuggestionIndex((prev) => (prev - 1 + SUGGESTIONS.length) % SUGGESTIONS.length);

                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();

                handleSuggestionClick(SUGGESTIONS[selectedSuggestionIndex]);

                return;
            }

            if (e.key === 'Escape') {
                setSuggestionsVisible(false);

                return;
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend, handleSuggestionClick, selectedSuggestionIndex, suggestionsVisible]);

    return (
        <div className="chat-input" style={{position: 'relative'}}>
            <textarea
                ref={inputRef}
                className="chat-input-field"
                rows={1}
                style={{}}
                placeholder="Type a message…"
                value={value}
                disabled={disabled}
                onChange={(e) => {
                    const sanitizedValue = e.target.value.replace(/\r?\n/g, ' ');

                    setValue(sanitizedValue);
                    setCaret(e.target.selectionStart ?? sanitizedValue.length);
                }}
                onSelect={(e) => {
                    const target = e.target as HTMLTextAreaElement;

                    setCaret(target.selectionStart ?? 0);
                }}
                onKeyDown={handleKeyDown}
            />
            <IconButton
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                aria-label="Send message"
                className="send-btn"
            >
                <SendDiagonal />
            </IconButton>
            {suggestionsVisible && (
                <ChatInputSuggestions
                    suggestions={SUGGESTIONS}
                    selectedIndex={selectedSuggestionIndex}
                    position={suggestionPosition}
                    onSuggestionClick={handleSuggestionClick}
                    onSuggestionHover={setSelectedSuggestionIndex}
                    getMenuSize={setMenuSize}
                />
            )}
        </div>
    );
};
