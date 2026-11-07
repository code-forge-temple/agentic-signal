/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PayloadView} from './PayloadView';

// vitest runs without `globals`, so testing-library's automatic cleanup is never registered.
afterEach(() => {
    cleanup();
});

describe('PayloadView', () => {
    it('reports a payload it can\'t format once, and shows that there is no output', () => {
        const circular: Record<string, unknown> = {name: 'loop'};

        circular.self = circular;

        const onError = vi.fn();
        const {rerender} = render(<PayloadView value={circular} onError={onError} />);

        rerender(<PayloadView value={circular} onError={onError} />);

        expect(screen.queryByText('No output available')).not.toBeNull();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toMatch(/^Error formatting content: /);
    });

    it('shows text as it is', () => {
        render(<PayloadView value="Plain words" onError={vi.fn()} />);

        expect(screen.queryByText('Plain words')).not.toBeNull();
    });
});
