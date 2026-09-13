/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useStreamThrottle} from './useStreamThrottle';

const DELAY = 500;

const setup = () => {
    const onFlush = vi.fn();
    const {result} = renderHook(() => useStreamThrottle<string>({delay: DELAY, onFlush}));

    return {onFlush, result};
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useStreamThrottle', () => {
    it('does not re-emit a value that was already flushed', () => {
        // The reported bug: one stream's reply reappearing in the next message. A flush with
        // nothing newly pushed must emit nothing at all.
        const {onFlush, result} = setup();

        act(() => { result.current.push('stream one reply'); });
        act(() => { result.current.flush(); });

        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush).toHaveBeenCalledWith('stream one reply');

        act(() => { result.current.flush(); });

        expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it('cancels the armed timer when flushed manually', () => {
        // The orphaned-timer half: flush() used to null the handle without clearing the
        // timeout, so it fired up to `delay` later and repainted the stale value.
        const {onFlush, result} = setup();

        act(() => { result.current.push('partial'); });
        act(() => { result.current.flush(); });

        expect(onFlush).toHaveBeenCalledTimes(1);

        act(() => { vi.advanceTimersByTime(DELAY * 4); });

        expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it('survives the full delete-then-resend sequence without replaying', () => {
        const {onFlush, result} = setup();

        // Stream one completes.
        act(() => { result.current.push('old answer'); });
        act(() => { result.current.flush(); });

        onFlush.mockClear();

        // User deletes both messages, then sends again; stream two fails before any chunk,
        // so handleSend's trailing flush() is all that runs.
        act(() => { result.current.cancel(); });
        act(() => { result.current.flush(); });
        act(() => { vi.advanceTimersByTime(DELAY * 4); });

        expect(onFlush).not.toHaveBeenCalled();
    });

    it('discards both the timer and the pending value on cancel', () => {
        const {onFlush, result} = setup();

        act(() => { result.current.push('aborted text'); });
        act(() => { result.current.cancel(); });
        act(() => { vi.advanceTimersByTime(DELAY * 4); });

        expect(onFlush).not.toHaveBeenCalled();

        act(() => { result.current.flush(); });

        expect(onFlush).not.toHaveBeenCalled();
    });

    it('still throttles: one emission per delay window, carrying the newest value', () => {
        const {onFlush, result} = setup();

        act(() => {
            result.current.push('a');
            result.current.push('ab');
            result.current.push('abc');
        });

        expect(onFlush).not.toHaveBeenCalled();

        act(() => { vi.advanceTimersByTime(DELAY); });

        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush).toHaveBeenCalledWith('abc');
    });

    it('emits again on a later window when new values arrive', () => {
        const {onFlush, result} = setup();

        act(() => { result.current.push('first'); });
        act(() => { vi.advanceTimersByTime(DELAY); });
        act(() => { result.current.push('second'); });
        act(() => { vi.advanceTimersByTime(DELAY); });

        expect(onFlush).toHaveBeenCalledTimes(2);
        expect(onFlush).toHaveBeenNthCalledWith(2, 'second');
    });
});
