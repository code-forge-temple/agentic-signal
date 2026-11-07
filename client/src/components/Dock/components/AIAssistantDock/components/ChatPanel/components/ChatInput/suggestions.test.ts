/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {matchingSuggestions} from './suggestions';


const commands = ['/convert', '/crypto', '/holidays', '/research', '/summarize', '/weather'].map(value => ({value}));
const values = (typed: string) => matchingSuggestions(commands, typed).map(s => s.value);

describe('matchingSuggestions', () => {
    it('offers everything for the bare `/` or `@`, in the given order', () => {
        expect(values('/')).toEqual(['/convert', '/crypto', '/holidays', '/research', '/summarize', '/weather']);
    });

    it('keeps the commands starting with what is typed, so the likeliest is first', () => {
        expect(values('/wea')).toEqual(['/weather']);
        expect(values('/c')).toEqual(['/convert', '/crypto']);
        expect(values('/cr')).toEqual(['/crypto']);
    });

    it('ignores case', () => {
        expect(values('/WEA')).toEqual(['/weather']);
    });

    it('then adds those containing it, after the ones starting with it', () => {
        expect(values('/ar')).toEqual(['/research', '/summarize']);
        expect(values('/ea')).toEqual(['/research', '/weather']);
        expect(values('/su')).toEqual(['/summarize']);
    });

    it('only matches a single letter at the start, which would otherwise be in nearly every name', () => {
        expect(values('/s')).toEqual(['/summarize']);
        expect(values('/z')).toEqual([]);
    });

    it('offers nothing when nothing matches, so the menu closes', () => {
        expect(values('/zz')).toEqual([]);
    });

    it('works the same for the `@` keywords, keeping their descriptions', () => {
        const keywords = [{value: '@prepare-workflow', description: 'a'}, {value: '@current-workflow', description: 'b'}];

        expect(matchingSuggestions(keywords, '@cur')).toEqual([{value: '@current-workflow', description: 'b'}]);
        expect(matchingSuggestions(keywords, '@workflow').map(s => s.value)).toEqual(['@prepare-workflow', '@current-workflow']);
    });
});
