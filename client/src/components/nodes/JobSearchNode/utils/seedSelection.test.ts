/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {isGroupSelected, SEED_GROUPS, seedCompaniesOf, toggle, toggleAll, toggleGroup} from './seedSelection';
import {ALL_SEED_KEYS, SEED_COMPANIES, seedKeyOf} from '../seedCompanies';


describe('seed selection', () => {
    it('groups the built-in companies by ATS, leaving out an ATS with none', () => {
        expect(SEED_GROUPS.flatMap(group => group.keys).sort()).toEqual([...ALL_SEED_KEYS].sort());
        expect(SEED_GROUPS.every(group => group.keys.length > 0 && group.keys.every(key => key.startsWith(`${group.ats}:`)))).toBe(true);
    });

    it('finds the companies the keys name, skipping a key no longer in the list', () => {
        const [first] = SEED_COMPANIES;

        expect(seedCompaniesOf([seedKeyOf(first), 'gone:company'])).toEqual([first]);
    });

    it('adds a group in full, or takes it out when all of it is selected', () => {
        const group = ['a:1', 'a:2'];

        expect(toggleGroup(['b:1', 'a:1'], group)).toEqual(['b:1', 'a:1', 'a:2']);
        expect(toggleGroup(['b:1', 'a:1', 'a:2'], group)).toEqual(['b:1']);
        expect(isGroupSelected(new Set(['a:2', 'a:1']), group)).toBe(true);
        expect(isGroupSelected(new Set(['a:2']), group)).toBe(false);
    });

    it('selects every built-in company, or none when every one is selected', () => {
        expect(toggleAll([])).toEqual(ALL_SEED_KEYS);
        expect(toggleAll([...ALL_SEED_KEYS])).toEqual([]);
    });

    it('adds a value to a list, or takes it out', () => {
        expect(toggle(['full_time'], 'contract')).toEqual(['full_time', 'contract']);
        expect(toggle(['full_time', 'contract'], 'full_time')).toEqual(['contract']);
    });
});
