/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {extremeRows, keyProblem, parseRows, rowsShape, sortRows} from './rows';
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

    it('takes as dates only text that looks like one: 2024-01-02 (a time too), 01/02/2024, a month name with a year', () => {
        const dates = [
            '2024-01-02', '2024-01-02T10:30:00Z', '2024-1-2 08:00', '2024-01-02 10:00:00 UTC', '01/02/2024', '1/2/24', '1/9/2024 9:00 AM',
            '2024/1/10', '12-31-2024', '2024-01-02 10:00:00+00', '2024-01-02 10:00 EST', 'Jan 2, 2024', '2 January 2024', 'Tuesday, March 3 2025',
        ];

        for (const date of dates) expect(rowsShape([date, '2023-12-31'], undefined).itemType, date).toBe(ARRAY_ITEM_TYPES.DATE);
    });

    it('takes text ending in a number as text, although V8 reads it as a date', () => {
        for (const labels of [['Item 1', 'Item 12', 'Item 2'], ['Order 3', 'hello 5'], ['May 5', 'June 7'], ['Mayhem 2024', 'Item 2024']]) {
            expect(rowsShape(labels, undefined).itemType, labels.join(', ')).toBeUndefined();
        }
    });

    it('reads objects by their key', () => {
        expect(rowsShape([{n: 1}, {n: 2}], 'n')).toEqual({key: 'n', objects: true, itemType: ARRAY_ITEM_TYPES.NUMBER});
    });
});

describe('sortRows', () => {
    it('sorts values, and objects by their key, as their type', () => {
        expect(sortRows([10, 9, 100], SORT_ORDER.ASC, undefined)).toEqual([9, 10, 100]);
        expect(sortRows(['10', '9', '100'], SORT_ORDER.ASC, undefined)).toEqual(['9', '10', '100']);
        expect(sortRows([{n: 3}, {n: 1}, {n: 2}], SORT_ORDER.DESC, 'n')).toEqual([{n: 3}, {n: 2}, {n: 1}]);
    });

    it('sorts dates by their time, a bare 2024-01-02 being that day here (not midnight UTC)', () => {
        expect(sortRows(['2024/1/10', '2024/1/9', '2023/12/31'], SORT_ORDER.ASC, undefined)).toEqual(['2023/12/31', '2024/1/9', '2024/1/10']);
        expect(sortRows(['2024-01-02', '2024-01-01 22:00'], SORT_ORDER.ASC, undefined)).toEqual(['2024-01-01 22:00', '2024-01-02']);
        expect(sortRows(['1/10/2024 9:00 AM', '1/9/2024 9:00 PM'], SORT_ORDER.DESC, undefined)).toEqual(['1/10/2024 9:00 AM', '1/9/2024 9:00 PM']);
        expect(sortRows(['12-31-2024', '01-15-2025', '06-01-2024'], SORT_ORDER.ASC, undefined)).toEqual(['06-01-2024', '12-31-2024', '01-15-2025']);
        // 10:00 UTC, then 09:00 at UTC-5 (14:00 UTC).
        expect(sortRows(['2024-01-02 09:00:00-05', '2024-01-02 10:00:00+00'], SORT_ORDER.ASC, undefined)).toEqual(['2024-01-02 10:00:00+00', '2024-01-02 09:00:00-05']);
        // A year under 100 is that year, not one in the 1900s.
        expect(sortRows(['1998-06-01', '0099-01-01'], SORT_ORDER.ASC, undefined)).toEqual(['0099-01-01', '1998-06-01']);
    });

    it('sorts dates written with a comma before the time, or with a 2-digit year', () => {
        expect(sortRows(['1/10/2024, 9:00:00 AM', '1/2/2024, 10:30:00 AM', '12/1/2023, 1:00:00 PM'], SORT_ORDER.DESC, undefined))
            .toEqual(['1/10/2024, 9:00:00 AM', '1/2/2024, 10:30:00 AM', '12/1/2023, 1:00:00 PM']);
        expect(sortRows(['12-31-24', '01-15-25', '06-01-24'], SORT_ORDER.ASC, undefined)).toEqual(['06-01-24', '12-31-24', '01-15-25']);
    });

    it('takes a day that does not exist as text, so the column compares as text', () => {
        expect(rowsShape(['2023-02-29', '2023-01-01'], undefined).itemType).toBeUndefined();
    });

    it('compares mixed values as text, the same way each time (one "N/A" among numbers)', () => {
        expect(sortRows([10, 'N/A', 9, 100, 2], SORT_ORDER.ASC, undefined)).toEqual([10, 100, 2, 9, 'N/A']);
    });

    it('sorts labels ending in a number as text', () => {
        expect(sortRows(['Item 2', 'Item 12', 'Item 1'], SORT_ORDER.ASC, undefined)).toEqual(['Item 1', 'Item 12', 'Item 2']);
    });

    it('puts rows with no value last, in their order, either way; the others compare as their type', () => {
        const rows = [{n: '10'}, {n: null}, {n: '9'}, {}, {n: ' '}, {n: '100'}];

        expect(sortRows(rows, SORT_ORDER.ASC, 'n')).toEqual([{n: '9'}, {n: '10'}, {n: '100'}, {n: null}, {}, {n: ' '}]);
        expect(sortRows(rows, SORT_ORDER.DESC, 'n')).toEqual([{n: '100'}, {n: '10'}, {n: '9'}, {n: null}, {}, {n: ' '}]);
        expect(sortRows([3, null, 1, ''], SORT_ORDER.ASC, undefined)).toEqual([1, 3, null, '']);
    });

    it('takes a null row among objects as one with no value', () => {
        expect(sortRows([{n: '10'}, {n: null}, null, {n: '9'}], SORT_ORDER.ASC, 'n')).toEqual([{n: '9'}, {n: '10'}, {n: null}, null]);
    });
});

describe('keyProblem', () => {
    const noKey = 'no key';

    it('needs a key for objects, one that some object has', () => {
        expect(keyProblem([{n: 1}], undefined, noKey)).toBe(noKey);
        expect(keyProblem([{n: 1}], '', noKey)).toBe(noKey);
        expect(keyProblem([{n: 1}], 'm', noKey)).toBe('`key` tool parameter \'m\' provided not found in any object of the `rows` array tool parameter');
        expect(keyProblem([{n: 1}, {m: 2}], 'm', noKey)).toBeNull();
    });

    it('has nothing to say about values, or no rows', () => {
        expect(keyProblem([1, 2], undefined, noKey)).toBeNull();
        expect(keyProblem([], undefined, noKey)).toBeNull();
    });

    it('still checks objects with a null row among them', () => {
        expect(keyProblem([{n: 1}, {n: 2}, null], undefined, noKey)).toBe(noKey);
        expect(keyProblem([{n: 1}, null], 'm', noKey)).toBe('`key` tool parameter \'m\' provided not found in any object of the `rows` array tool parameter');
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

    it('gives every row the sort counts as equal, text mode included (5 and "5")', () => {
        expect(extremeRows([{n: 5}, {n: '5'}, {n: 'abc'}], 'n', MIN)).toEqual([{n: 5}, {n: '5'}]);
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

    it('leaves out rows with no value (no key, null, blank), so they are never the smallest or the largest', () => {
        const rows = [{n: 5}, {n: 12}, {m: 1}, {n: null}, {n: ''}];

        expect(extremeRows(rows, 'n', MAX)).toEqual([{n: 12}]);
        expect(extremeRows(rows, 'n', MIN)).toEqual([{n: 5}]);
        expect(extremeRows([{price: 12}, {price: null}, {price: 3}], 'price', MIN)).toEqual([{price: 3}]);
        expect(extremeRows([4, null, ' ', 2], undefined, MIN)).toEqual([2]);
        expect(extremeRows([{n: 5}, {n: []}], 'n', MIN)).toEqual([{n: 5}]);
    });

    it('reads objects by their key among plain values too: those have no value', () => {
        expect(extremeRows([{n: 5}, {n: 1}, 3], 'n', MIN)).toEqual([{n: 1}]);
        expect(sortRows([{n: 5}, {n: 1}, 3, 7], SORT_ORDER.ASC, 'n')).toEqual([{n: 1}, {n: 5}, 3, 7]);
        expect(extremeRows([{n: 5}, 3], undefined, MIN)).toEqual({error: '`key` tool parameter is required when finding min in arrays of objects'});
    });

    it('gives a row with an impossible day (text, then) when the rest are text too', () => {
        expect(extremeRows([{d: '2023-02-29'}, {d: '2023-01-01'}], 'd', MAX)).toEqual([{d: '2023-02-29'}]);
    });

    it('leaves out a null row among objects, and checks their key as without it', () => {
        expect(extremeRows([{price: 12}, {price: null}, {price: 3}, null], 'price', MIN)).toEqual([{price: 3}]);
        expect(extremeRows([{n: 1}, {n: 2}, null], 'm', MAX))
            .toEqual({error: '`key` tool parameter \'m\' provided not found in any object of the `rows` array tool parameter'});
    });

    it('gives nothing when no row has a value', () => {
        expect(extremeRows([{n: null}, {n: ''}, {m: 2}], 'n', MAX)).toEqual([]);
        expect(extremeRows([null, ''], undefined, MIN)).toEqual([]);
    });
});
