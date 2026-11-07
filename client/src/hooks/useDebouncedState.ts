/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useRef, useState} from "react";

export type UseDebouncedStateProps<T> = {
    callback: (value: T) => void;
    delay?: number;
    initialValue: T;
}


/** [value, set it and call back after the delay, set it without calling back] */
export function useDebouncedState<T> ({callback, delay, initialValue}: UseDebouncedStateProps<T>): [T, (value: T) => void, (value: T) => void] {
    const timeoutRef = useRef<number | null>(null);
    const [value, setValue] = useState<T>(initialValue);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const onValueChange = (newValue: any) => {
        setValue(newValue);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() => {
            callback(newValue);
        }, delay || 300);
    };

    // For a value that came from elsewhere: nothing is called back, and a call still waiting is dropped
    // (it would overwrite that value with what was typed before it).
    const replaceValue = (newValue: T) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        setValue(newValue);
    };

    return [
        value,
        onValueChange,
        replaceValue
    ]
}