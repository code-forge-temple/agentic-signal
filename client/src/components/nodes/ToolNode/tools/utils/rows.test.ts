/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {extremeRows, parseRows, rowsShape, sortRows} from './rows';
import {ARRAY_ITEM_TYPES, SORT_ORDER} from './sort';


const MIN = {order: SORT_ORDER.ASC, name: 'min'};
const MAX = {order: SORT_ORDER.DESC, name: 'max'};

describe('parseRows', () => {
    it('takes an array, or a JSON array as text', () => {
        expect(parseRows([1, 2])).toEqual([1, 2]);
        expect(parseRows('[5, 2]')).toEqual([5, 2]);
    });

    it('turns down anything else', () => {
        for (const rows of ['not an array', '{"a": 1}', 42]) {
            expect(parseRows(rows)).toEqual({error: '`rows` tool parameter must be an array'});
        }
    });
});

describe('rowsShape', () => {
    it('compares as booleans, then dates, then numbers, when all the values are one; else as text', () => {
        expect(rowsShape([true, false], undefined).itemType).toBe(ARRAY_ITEM_TYPES.BOOLEAN);
        expect(rowsShape(['2024-01-02', 'Jan 2, 2024'], undefined).itemType).toBe(ARRAY_ITEM_TYPES.DATE);
        expect(rowsShape([10, 9.5], undefined).itemType).toBe(ARRAY_ITEM_TYPES.NUMBER);
        expect(rowsShape(['b', 'a'], undefined).itemType).toBeUndefined();
    });

    it('takes numbers written as text (from CSV, say) as numbers, although V8 reads them as dates too', () => {
        expect(rowsShape(['10', '9.5', '2024'], undefined).itemType).toBe(ARRAY_ITEM_TYPES.NUMBER);
        expect(rowsShape([{n: '10'}, {n: '100'}], 'n').itemType).toBe(ARRAY_ITEM_TYPES.NUMBER);
        // Neither all dates once one is a plain number, nor all numbers: they compare as text.
        expect(rowsShape(['10', '2024-01-02'], undefined).itemType).toBeUndefined();
    });

    it('reads objects by their key', () => {
        expect(rowsShape([{n: 1}, {n: 2}], 'n')).toEqual({key: 'n', allObjects: true, itemType: ARRAY_ITEM_TYPES.NUMBER});
    });
});

describe('sortRows', () => {
    it('sorts values, and objects by their key, as their type', () => {
        expect(sortRows([10, 9, 100], SORT_ORDER.ASC, rowsShape([10, 9, 100], undefined))).toEqual([9, 10, 100]);
        expect(sortRows(['10', '9', '100'], SORT_ORDER.ASC, rowsShape(['10', '9', '100'], undefined))).toEqual(['9', '10', '100']);

        const rows = [{n: 3}, {n: 1}, {n: 2}];

        expect(sortRows(rows, SORT_ORDER.DESC, rowsShape(rows, 'n'))).toEqual([{n: 3}, {n: 2}, {n: 1}]);
    });
});

describe('extremeRows', () => {
    it('gives every row that shares the smallest or the largest value', () => {
        expect(extremeRows([3, 1, 2, 1], undefined, MIN)).toEqual([1, 1]);
        expect(extremeRows([3, 1, 3, 2], undefined, MAX)).toEqual([3, 3]);
        expect(extremeRows(['2024-01-02', '2023-12-31'], undefined, MAX)).toEqual(['2024-01-02']);
        expect(extremeRows(['10', '9', '100'], undefined, MAX)).toEqual(['100']);
    });

    it('compares booleans written as text as the sort does: "FALSE" is false (lowercase ones arrive as booleans)', () => {
        expect(extremeRows(['FALSE', true, 'False'], undefined, MIN)).toEqual(['FALSE', 'False']);
        expect(extremeRows(['FALSE', 'TRUE', false], undefined, MAX)).toEqual(['TRUE']);
    });

    it('compares objects by their key', () => {
        const rows = [{name: 'a', n: 3}, {name: 'b', n: 1}, {name: 'c', n: 3}];

        expect(extremeRows(rows, 'n', MAX)).toEqual([{name: 'a', n: 3}, {name: 'c', n: 3}]);
        expect(extremeRows(rows, 'n', MIN)).toEqual([{name: 'b', n: 1}]);
    });

    it('needs a key for objects, one that some object has', () => {
        const notFound = {error: '`key` tool parameter \'missing\' provided not found in any object of the `rows` array tool parameter'};

        expect(extremeRows([{n: 1}], undefined, MIN)).toEqual({error: '`key` tool parameter is required when finding min in arrays of objects'});
        expect(extremeRows([{n: 1}], 'missing', MAX)).toEqual(notFound);
        expect(extremeRows([{n: 1}], 'missing', MIN)).toEqual(notFound);
    });

    it('gives nothing for no rows, and an error for rows that are no array', () => {
        expect(extremeRows([], undefined, MIN)).toEqual([]);
        expect(extremeRows('nope', undefined, MAX)).toEqual({error: '`rows` tool parameter must be an array'});
    });
});
