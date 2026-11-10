/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it, vi} from 'vitest';
import {countWithin, saveCountWithin} from './countWithin';


describe('countWithin', () => {
    it('keeps a typed count within its range', () => {
        expect(countWithin('5', 0, 10)).toBe(5);
        expect(countWithin('25', 0, 10)).toBe(10);
        expect(countWithin('-3', 0, 10)).toBe(0);
    });

    it('gives null for text that is not a number, as in a cleared field', () => {
        expect(countWithin('', 0, 10)).toBeNull();
        expect(countWithin('abc', 0, 10)).toBeNull();
    });
});

describe('saveCountWithin', () => {
    it('saves the count within its range and gives back its text', () => {
        const save = vi.fn();

        expect(saveCountWithin('5000', 64, 2048, save)).toBe('2048');
        expect(save).toHaveBeenCalledWith(2048);
    });

    it('saves nothing for a cleared field, and gives nothing back', () => {
        const save = vi.fn();

        expect(saveCountWithin('', 64, 2048, save)).toBeUndefined();
        expect(save).not.toHaveBeenCalled();
    });
});
