/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {cleanup, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useTimerTrigger} from './useTimerTrigger';


describe('useTimerTrigger', () => {
    afterEach(() => {
        cleanup();
    });

    it('runs the latest callback once per new trigger, and not when only the callback changes', () => {
        const runs = vi.fn();
        const {rerender} = renderHook(({trigger, name}) => useTimerTrigger(trigger, () => runs(name)), {initialProps: {trigger: undefined as number | undefined, name: 'a'}});

        rerender({trigger: undefined, name: 'b'});
        expect(runs).not.toHaveBeenCalled();

        rerender({trigger: 100, name: 'c'});
        rerender({trigger: 100, name: 'd'});
        rerender({trigger: 200, name: 'e'});

        expect(runs.mock.calls).toEqual([['c'], ['e']]);
    });
});
