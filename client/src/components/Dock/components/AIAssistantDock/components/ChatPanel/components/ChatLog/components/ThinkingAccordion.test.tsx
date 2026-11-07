/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {ThinkingAccordion} from './ThinkingAccordion';

// vitest runs without `globals`, so testing-library's automatic cleanup is never registered.
afterEach(() => {
    cleanup();
});

const RESULTS = 'The three pages say the same thing.';

describe('ThinkingAccordion', () => {
    it('keeps folded content out of the page until it is opened', () => {
        render(<ThinkingAccordion thinking={RESULTS} isStreaming={false} label="Results" defaultOpen={false} />);

        expect(screen.queryByText(RESULTS)).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Results/}));

        expect(screen.queryByText(RESULTS)).not.toBeNull();
    });

    it('keeps the content while it folds away, and drops it once folded', () => {
        const {container} = render(<ThinkingAccordion thinking={RESULTS} isStreaming={false} label="Results" />);

        fireEvent.click(screen.getByRole('button', {name: /Results/}));
        expect(screen.queryByText(RESULTS)).not.toBeNull();

        fireEvent.transitionEnd(container.querySelector('.thinking-body')!);
        expect(screen.queryByText(RESULTS)).toBeNull();
    });

    it('folds a finished thought process away, and drops it once folded', () => {
        const {container, rerender} = render(<ThinkingAccordion thinking="Working it out" isStreaming={true} />);

        expect(screen.queryByText('Working it out')).not.toBeNull();

        rerender(<ThinkingAccordion thinking="Working it out" isStreaming={false} />);
        fireEvent.transitionEnd(container.querySelector('.thinking-body')!);

        expect(screen.queryByText('Working it out')).toBeNull();
    });
});
