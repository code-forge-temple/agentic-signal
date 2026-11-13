/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {RunOptions} from './RunOptions';
import {defaultLlmProcessNodeData} from '../types/workflow';


const field = (name: string) => screen.getByRole<HTMLInputElement>('spinbutton', {name});

// Types into the field and waits out its debounce.
const type = (name: string, text: string) => {
    fireEvent.change(field(name), {target: {value: text}});
    act(() => {
        vi.advanceTimersByTime(300);
    });
};

describe('RunOptions counts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('saves nothing for a cleared Max Feedback Loops, and keeps a typed one within 0 to 10', () => {
        const change = vi.fn();

        render(<RunOptions data={{...defaultLlmProcessNodeData, maxFeedbackLoops: 2}} change={change} currentLoop={0} />);

        type('Max Feedback Loops', '');
        expect(change).not.toHaveBeenCalled();

        type('Max Feedback Loops', '4');
        expect(change).toHaveBeenLastCalledWith({maxFeedbackLoops: 4});

        type('Max Feedback Loops', '25');
        expect(change).toHaveBeenLastCalledWith({maxFeedbackLoops: 10});
    });

    it('saves nothing for a cleared Max Tool Retries, and keeps a typed one within 3 to 10', () => {
        const change = vi.fn();

        render(<RunOptions data={defaultLlmProcessNodeData} change={change} currentLoop={0} />);

        type('Max Tool Retries', '');
        expect(change).not.toHaveBeenCalled();

        type('Max Tool Retries', '1');
        expect(change).toHaveBeenLastCalledWith({maxToolRetries: 3});
    });

    it('shows the count it saved, also when that is the count already there', () => {
        render(<RunOptions data={{...defaultLlmProcessNodeData, maxFeedbackLoops: 2}} change={vi.fn()} currentLoop={0} />);

        type('Max Feedback Loops', '25');
        expect(field('Max Feedback Loops').value).toBe('10');

        // Already 3: typing 1 saves 3 again, so the node's value doesn't change.
        type('Max Tool Retries', '1');
        expect(field('Max Tool Retries').value).toBe('3');
    });
});
