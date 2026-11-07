/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DebouncedTextField} from './DebouncedTextField';


const field = () => screen.getByRole<HTMLInputElement>('textbox', {name: 'Model'});
const type = (text: string) => fireEvent.change(field(), {target: {value: text}});

describe('DebouncedTextField', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('sends what was typed once, after the delay', () => {
        const onChange = vi.fn();

        render(<DebouncedTextField label="Model" value="" onChange={onChange} />);
        type('ll');
        type('llama');
        expect(field().value).toBe('llama');
        expect(onChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('llama');
    });

    it('shows a value changed from outside without sending it back', () => {
        const onChange = vi.fn();
        const {rerender} = render(<DebouncedTextField label="Model" value="llama3" onChange={onChange} />);

        rerender(<DebouncedTextField label="Model" value="Downloading llama3 45%" onChange={onChange} />);
        expect(field().value).toBe('Downloading llama3 45%');

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('drops a typed change still waiting when the value changes from outside', () => {
        const onChange = vi.fn();
        const {rerender} = render(<DebouncedTextField label="Model" value="" onChange={onChange} />);

        type('half typed');
        // Cleared by the parent (say, after Add) before the delay ran out.
        rerender(<DebouncedTextField label="Model" value="reset" onChange={onChange} />);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(field().value).toBe('reset');
        expect(onChange).not.toHaveBeenCalled();
    });
});
