/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {zodIssues} from './zodIssues';


const errorOf = (schema: z.ZodTypeAny, value: unknown) => {
    const parsed = schema.safeParse(value);

    if (parsed.success) throw new Error('expected the check to fail');

    return parsed.error;
};

const ACTIONS = z.array(z.object({selector: z.string(), count: z.number()}));

describe('zodIssues', () => {
    it('names each wrong field by its path, one after another', () => {
        expect(zodIssues(errorOf(ACTIONS, [{selector: '#a', count: 1}, {count: 'x'}])))
            .toBe('1.selector: Required; 1.count: Expected number, received string');
    });

    it('gives a problem with the value itself as its message, or under the root name', () => {
        expect(zodIssues(errorOf(z.object({}), 'text'))).toBe('Expected object, received string');
        expect(zodIssues(errorOf(z.object({}), 'text'), {rootName: 'body'})).toBe('body: Expected object, received string');
    });

    it('joins paths with the separator, after the prefix', () => {
        expect(zodIssues(errorOf(ACTIONS, [{count: 1}]), {separator: '→', prefix: ['data']})).toBe('data→0→selector: Required');
    });
});
