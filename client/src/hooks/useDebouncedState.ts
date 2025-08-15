/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useRef, useState} from "react";

type UseDebouncedStateProps<T> = {
    callback: (value: T) => void;
    delay?: number;
    initialValue: T;
}


export function useDebouncedState<T> ({callback, delay, initialValue}: UseDebouncedStateProps<T>): [T, (value: T) => void] {
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

    return [
        value,
        onValueChange
    ]
}