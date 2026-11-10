/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {cleanup, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useOnMount} from './useOnMount';


describe('useOnMount', () => {
    afterEach(() => {
        cleanup();
    });

    it('runs once, with the first render\'s values, and not on later renders', () => {
        const onMount = vi.fn();
        const {rerender} = renderHook(({value}) => useOnMount(() => onMount(value)), {initialProps: {value: 1}});

        rerender({value: 2});
        rerender({value: 3});

        expect(onMount.mock.calls).toEqual([[1]]);
    });
});
