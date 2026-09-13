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
        // Cleared, not just nulled: a manual flush used to leave the scheduled timeout armed,
        // so it fired later and re-emitted whatever was still pending.
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        const pending = pendingValueRef.current;

        /*
         * Read out and cleared BEFORE the callback runs. Holding on to the value let one
         * stream's reply get repainted into the next stream's message: delete a reply, send a
         * new message, and a flush that happened before the next push would write the old
         * text into the fresh placeholder.
         */
        pendingValueRef.current = null;

        if (pending !== null) {
            onFlush(pending);
        }
    }, [onFlush]);

    const push = useCallback((value: T) => {
        pendingValueRef.current = value;

        if (timerRef.current !== null) {
            return;
        }

        timerRef.current = window.setTimeout(flush, delay);
    }, [delay, flush]);

    /** Discards anything buffered, so a superseded or deleted stream can never repaint. */
    const cancel = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        pendingValueRef.current = null;
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