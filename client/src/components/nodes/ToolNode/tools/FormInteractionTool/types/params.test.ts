/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {RawLlmFillActionSchema} from './params';

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
