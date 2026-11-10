/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {dataInput} from './dataInput';


describe('dataInput', () => {
    it('is the input itself, so each delivery counts, the same data sent again too', () => {
        const input = {payload: 'hello'};
        const again = {payload: 'hello'};

        expect(dataInput(input)).toBe(input);
        expect(dataInput(again)).toBe(again);
    });

    it('keeps an input with no data that is not a timer trigger', () => {
        const toolsOnly = {toolsPayload: {files: []}};
        const empty = {payload: undefined};

        expect(dataInput(toolsOnly)).toBe(toolsOnly);
        expect(dataInput(empty)).toBe(empty);
    });

    it('is undefined for a timer trigger alone, and for no input', () => {
        expect(dataInput({timerTrigger: 1700000000000})).toBeUndefined();
        expect(dataInput(undefined)).toBeUndefined();
    });
});
