/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect, useRef, useLayoutEffect, useCallback} from 'react';
import {IconButton} from '@mui/material';
import {SendDiagonal} from 'iconoir-react';
import './ChatInput.scss';
import {ChatInputSuggestions, Suggestion} from './components/ChatInputSuggestions';
import {ContextGauge} from './components/ContextGauge';
import {ContextGaugeProps} from './components/contextTooltip';
import {matchingSuggestions} from './suggestions';


type ChatInputProps = {
    /** Returns whether the text was sent; a refused one stays in the field. */
    onSend: (text: string) => boolean;
    /** The commands the chat can run, offered when the message starts with `/`, e.g. "/research", each with what it does. */
    commands: Suggestion[];
    disabled: boolean;
    panelPosition?: { x: number; y: number };
    /* Sits with the field rather than up in the header: what it answers - is there room for
     * this message? - is only ever asked while composing one. */
    contextGauge: ContextGaugeProps;
};

const KEYWORD_SUGGESTIONS: Suggestion[] = [{value: '@prepare-workflow'}, {value: '@current-workflow'}];

export const ChatInput = ({onSend, commands, disabled, panelPosition, contextGauge}: ChatInputProps) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const prevDisabled = useRef(disabled);
    const [caret, setCaret] = useState<number>(0);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
            let textStart = 0;

            if (ctx) {
                const computedStyle = window.getComputedStyle(input);

                textStart = parseFloat(computedStyle.borderLeftWidth || '0') + parseFloat(computedStyle.paddingLeft || '0');
                ctx.font = computedStyle.font;
                caretPixelPos = ctx.measureText(textUpToCaret).width;
            }

            setSuggestionPosition({
                top: rect.top,
                left: rect.left + textStart + caretPixelPos - (input.scrollLeft || 0) + menuSize.width
            });
        }
    }, [suggestionsVisible, value, caret, menuSize, panelPosition]);

    useEffect(() => {
        const words = value.slice(0, caret).split(/\s/);
        const lastWord = words.pop() || '';
        // `@` keywords go anywhere; a `/` command only opens the message.
        const options = lastWord.startsWith('@')
            ? KEYWORD_SUGGESTIONS
            : lastWord.startsWith('/') && words.every(word => word === '') ? commands : [];
        const matching = matchingSuggestions(options, lastWord);

        setSuggestions(matching);
        setSuggestionsVisible(matching.length > 0);
        setSelectedSuggestionIndex(0);
    }, [value, caret, commands]);

    const handleSend = useCallback(() => {
        if (!value.trim() || disabled) return;

        if (!onSend(value.trim())) return;

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

                setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);

                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();

                setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);

                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();

                handleSuggestionClick(suggestions[selectedSuggestionIndex].value);

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
    }, [handleSend, handleSuggestionClick, selectedSuggestionIndex, suggestions, suggestionsVisible]);

    return (
        <div className="chat-input" style={{position: 'relative'}}>
            <ContextGauge {...contextGauge} />
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
                    suggestions={suggestions}
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
