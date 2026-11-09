/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useLoadingOverlay} from './useLoadingOverlay';


describe('useLoadingOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('shows the overlay at once with what `now` changes, and does the work 100 ms later', () => {
        const {result} = renderHook(() => useLoadingOverlay());
        const work = vi.fn();
        const now = vi.fn();

        act(() => result.current[1](work, now));

        expect(result.current[0]).toBe(true);
        expect(now).toHaveBeenCalledOnce();
        expect(work).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(work).toHaveBeenCalledOnce();
        expect(result.current[0]).toBe(false);
    });

    it('hides the overlay even when the work throws', () => {
        const {result} = renderHook(() => useLoadingOverlay());

        act(() => result.current[1](() => {
            throw new Error('bad file');
        }));

        let thrown: unknown;

        act(() => {
            try {
                vi.advanceTimersByTime(100);
            } catch (error) {
                thrown = error;
            }
        });

        expect(thrown).toEqual(new Error('bad file'));
        expect(result.current[0]).toBe(false);
    });
});
