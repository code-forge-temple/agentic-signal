/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useRef, useCallback, useEffect} from 'react';


type StreamThrottleOptions<T> = {
    delay?: number;
    onFlush: (value: T) => void;
};

export const useStreamThrottle = <T>({
    delay = 500,
    onFlush,
}: StreamThrottleOptions<T>) => {
    const pendingValueRef = useRef<T | null>(null);
    const timerRef = useRef<number | null>(null);

    const flush = useCallback(() => {
        timerRef.current = null;

        if (pendingValueRef.current !== null) {
            onFlush(pendingValueRef.current);
        }
    }, [onFlush]);

    const push = useCallback((value: T) => {
        pendingValueRef.current = value;

        if (timerRef.current !== null) {
            return;
        }

        timerRef.current = window.setTimeout(flush, delay);
    }, [delay, flush]);

    const cancel = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => cancel();
    }, [cancel]);

    return {
        push,
        flush,
        cancel,
    };
};