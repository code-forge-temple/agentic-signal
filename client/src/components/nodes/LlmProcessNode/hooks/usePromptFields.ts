/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useLayoutEffect, useRef} from "react";
import {useDebouncedState} from "../../../../hooks/useDebouncedState";
import {ChangeLlmProcessNodeData, LlmProcessNodeData} from "../types/workflow";


export type PromptField = [string, (value: string) => void];

const debounced = (initialValue: string, callback: (value: string) => void) => ({callback, delay: 300, initialValue});

/**
 * The prompt, message and structured-output texts, saved 300 ms after typing stops. Call it from a component that
 * stays mounted while the dialog closes: unmounting drops an edit still waiting to be saved.
 */
export function usePromptFields (data: LlmProcessNodeData, change: ChangeLlmProcessNodeData) {
    const {prompt, message, format} = data;
    // A save builds on the settings as they are when it happens, not as they were when the typing began: the other text
    // of the pair (the prefix while the suffix waits) may have been saved meanwhile. Each save also updates `latest` at
    // once, so a second save that comes before the next render builds on the first.
    const latest = useRef(data);

    useLayoutEffect(() => {
        latest.current = data;
    });

    const save = (changes: Partial<LlmProcessNodeData>) => {
        latest.current = {...latest.current, ...changes};
        change(changes);
    };

    const [systemPrompt, setSystemPrompt] = useDebouncedState(debounced(prompt || "", value => save({prompt: value})));
    const [prefix, setPrefix] = useDebouncedState(debounced(message?.prefix || "", value => save({message: {...latest.current.message, prefix: value}})));
    const [suffix, setSuffix] = useDebouncedState(debounced(message?.suffix || "", value => save({message: {...latest.current.message, suffix: value}})));
    const [onSuccess, setOnSuccess] = useDebouncedState(debounced(format?.onSuccess || "", value => save({format: {...latest.current.format, onSuccess: value}})));
    const [onError, setOnError] = useDebouncedState(debounced(format?.onError || "", value => save({format: {...latest.current.format, onError: value}})));

    return {
        systemPrompt: [systemPrompt, setSystemPrompt] as PromptField,
        prefix: [prefix, setPrefix] as PromptField,
        suffix: [suffix, setSuffix] as PromptField,
        onSuccess: [onSuccess, setOnSuccess] as PromptField,
        onError: [onError, setOnError] as PromptField,
    };
}

export type PromptFields = ReturnType<typeof usePromptFields>;
