/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {parseFillActions, RawLlmFillActionSchema, toFillAction} from './params';

describe('RawLlmFillActionSchema', () => {
    it('takes a null value or fileKey as omitted', () => {
        const result = RawLlmFillActionSchema.safeParse({actionType: 'check', selector: '#agreeTerms', value: null, fileKey: null});

        expect(result.success && result.data).toEqual({actionType: 'check', selector: '#agreeTerms'});
    });

    it('still rejects a value that is neither a string nor null', () => {
        expect(RawLlmFillActionSchema.safeParse({actionType: 'fill', selector: '#age', value: 7}).success).toBe(false);
    });

    it('shows the LLM value and fileKey as optional plain strings', () => {
        const schema = zodToJsonSchema(RawLlmFillActionSchema);

        expect(schema).toMatchObject({
            properties: {value: {type: 'string'}, fileKey: {type: 'string'}},
            required: ['selector', 'actionType'],
        });
    });
});

describe('toFillAction', () => {
    it('takes the value as the file of an upload that names none', () => {
        expect(toFillAction({selector: '#cv', actionType: 'upload', value: 'cv.pdf'})).toEqual({selector: '#cv', actionType: 'upload', value: 'cv.pdf', fileKey: 'cv.pdf'});
        expect(toFillAction({selector: '#cv', actionType: 'upload', value: 'x', fileKey: 'cv.pdf'})).toMatchObject({fileKey: 'cv.pdf'});
    });

    it('keeps a fileKey on other actions only when one was sent', () => {
        expect(toFillAction({selector: '#name', actionType: 'fill', value: 'Jane'})).not.toHaveProperty('fileKey');
        expect(toFillAction({selector: '#name', actionType: 'fill', value: 'Jane', fileKey: 'f'})).toMatchObject({fileKey: 'f'});
    });
});

describe('parseFillActions', () => {
    it('gives no actions for none, and converts the ones sent', () => {
        expect(parseFillActions(undefined)).toEqual([]);
        expect(parseFillActions([{selector: '#cv', actionType: 'upload', value: 'cv.pdf'}])).toEqual([{selector: '#cv', actionType: 'upload', value: 'cv.pdf', fileKey: 'cv.pdf'}]);
    });

    it('names each wrong field', () => {
        expect(parseFillActions([{selector: '#a', actionType: 'fill'}, {actionType: 'tap'}])).toEqual({
            error: expect.stringMatching(/^Invalid `actions`: 1\.selector: .+; 1\.actionType: /) as string,
        });
    });
});
