/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {cleanup, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useOnOpen} from './useOnOpen';


describe('useOnOpen', () => {
    afterEach(() => {
        cleanup();
    });

    it('runs each time `open` turns true, not on other renders', () => {
        const onOpen = vi.fn();
        const {rerender} = renderHook(({open, value}) => useOnOpen(open, () => onOpen(value)), {initialProps: {open: false, value: 1}});

        expect(onOpen).not.toHaveBeenCalled();

        rerender({open: true, value: 2});
        rerender({open: true, value: 3});
        expect(onOpen.mock.calls).toEqual([[2]]);

        rerender({open: false, value: 4});
        rerender({open: true, value: 5});
        expect(onOpen.mock.calls).toEqual([[2], [5]]);
    });
});
