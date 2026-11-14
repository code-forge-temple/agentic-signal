/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, expectTypeOf, it} from 'vitest';
import {getField, withDefaults} from './utils';
import {fileExtension} from '@shared/utils';


describe('getField', () => {
    it('reads a key that has a value, from objects and arrays alike', () => {
        expect(getField({a: 0}, 'a', 9)).toBe(0);
        expect(getField({a: false}, 'a', true)).toBe(false);
        expect(getField({a: 'x'}, 'a', 'f')).toBe('x');
        expect(getField(['z'], '0', 'f')).toBe('z');
        expect(getField(Object.create({inherited: 'p'}), 'inherited', 'f')).toBe('p');
    });

    it('falls back for a missing, undefined, null or empty value, or a source that isn\'t an object', () => {
        for (const value of [undefined, null, '']) expect(getField({a: value}, 'a', 'f')).toBe('f');

        expect(getField({}, 'a', 'f')).toBe('f');

        for (const source of [null, undefined, 'abc', 3, true]) expect(getField(source, 'length', 'f')).toBe('f');
    });
});

describe('withDefaults', () => {
    it('fills in a default for each prop missing or undefined, and keeps the rest, falsy ones too', () => {
        const defaults = {size: 'm', count: 3, on: true};

        expect(withDefaults({}, defaults)).toEqual({size: 'm', count: 3, on: true});
        const props: {size?: string; count?: number; on?: boolean; extra?: null} = {size: undefined, count: 0, on: false, extra: null};

        expect(withDefaults(props, defaults)).toEqual({size: 'm', count: 0, on: false, extra: null});
        expect(withDefaults({size: '', count: 1}, defaults)).toEqual({size: '', count: 1, on: true});
    });

    it('types each defaulted prop as the props declare it, not as the literal type of its default', () => {
        const props: {mode?: 'json' | 'markdown'; on?: boolean; label?: string} = {};
        const filled = withDefaults(props, {mode: 'json', on: false} as const);

        expectTypeOf(filled.mode).toEqualTypeOf<'json' | 'markdown'>();
        expectTypeOf(filled.on).toEqualTypeOf<boolean>();
        expectTypeOf(filled.label).toEqualTypeOf<string | undefined>();
    });
});

describe('fileExtension', () => {
    it('is the last extension, lower-cased; empty for a name without one', () => {
        expect(fileExtension('a.B.PDF')).toBe('pdf');
        expect(fileExtension('.env')).toBe('env');

        for (const name of ['pdf', 'Makefile', 'trailing.', '']) expect(fileExtension(name), name).toBe('');
    });
});
