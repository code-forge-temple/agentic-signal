/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {dateTime, dayAsWritten, isDateString, numericDay} from './dates';


const day = (year: number, month: number, date: number) => {
    const local = new Date(0);

    local.setFullYear(year, month - 1, date);
    local.setHours(0, 0, 0, 0);

    return local;
};

describe('isDateString', () => {
    it('takes text that looks like a date', () => {
        const dates = [
            '2024-01-02', '2024-01-02T10:30:00Z', '2024-1-2 08:00', '2024-01-02 10:00:00 UTC', '2024-01-02 10:00:00+00', '2024-01-02 10:00 EST',
            '2024/1/10', '2024.01.02', '01/02/2024', '1/2/24', '1/9/2024 9:00 AM', '1/2/2024, 10:30:00 AM', '12-31-2024', '12-31-24',
            'Jan 2, 2024', '2 January 2024', 'Tuesday, March 3 2025', 'Tue, 02 Jan 2024 10:30:00 GMT', 'January 2024',
        ];

        for (const date of dates) expect(isDateString(date), date).toBe(true);
    });

    it('takes numbers, labels ending in a number, and dates without a year as text', () => {
        for (const text of ['10', '2024', '12.5', 'Item 1', 'Order 3', 'hello 5', 'May 5', 'Mayhem 2024', 'day 3', '+1']) {
            expect(isDateString(text), text).toBe(false);
        }
    });

    it('turns down days that don\'t exist, which V8 rolls over', () => {
        for (const text of ['2023-02-29', '2024-04-31', '2/30/2024', '2026-13-45', '2026-11-131']) expect(isDateString(text), text).toBe(false);
    });

    it('takes a day-first 02.01.2024 as text: V8 reads it as 1 February', () => {
        expect(isDateString('02.01.2024')).toBe(false);
    });

    it('takes no zone V8 doesn\'t know, nor anything but text', () => {
        expect(isDateString('2024-01-02 10:00 CEST')).toBe(false);
        expect(isDateString(20240102)).toBe(false);
        expect(isDateString(null)).toBe(false);
    });
});

describe('numericDay', () => {
    it('reads the day a numeric date names, here, as written', () => {
        expect(numericDay('2026-11-15T00:00:00Z')).toEqual(day(2026, 11, 15));
        expect(numericDay('11/13/2026 23:30 UTC')).toEqual(day(2026, 11, 13));
        expect(numericDay('2024.01.02')).toEqual(day(2024, 1, 2));
    });

    it('reads a 2-digit year as JavaScript does, and keeps a 4-digit year under 100', () => {
        expect(numericDay('1/2/24')).toEqual(day(2024, 1, 2));
        expect(numericDay('1/2/75')).toEqual(day(1975, 1, 2));
        expect(numericDay('0099-01-01')?.getFullYear()).toBe(99);
    });

    it('is null for a day that doesn\'t exist, undefined for text that isn\'t numeric', () => {
        expect(numericDay('2023-02-29')).toBeNull();
        expect(numericDay('Nov 13, 2026')).toBeUndefined();
    });
});

describe('dateTime', () => {
    it('reads a bare 2024-01-02 as that day here, other dates as JavaScript does', () => {
        expect(dateTime('2024-01-02')).toBe(day(2024, 1, 2).getTime());
        expect(dateTime('2024-01-02T10:00:00Z')).toBe(Date.UTC(2024, 0, 2, 10));
        expect(dateTime('2024-01-01 22:00')).toBeLessThan(dateTime('2024-01-02'));
    });
});

describe('dayAsWritten', () => {
    it('gives the day the date names, whatever its time and zone', () => {
        expect(dayAsWritten('2026-11-15T23:00:00Z')).toEqual(day(2026, 11, 15));
        expect(dayAsWritten('Nov 13, 2026 23:00 GMT')).toEqual(day(2026, 11, 13));
        expect(dayAsWritten('Tue, 02 Jan 2024 23:30:00 GMT')).toEqual(day(2024, 1, 2));
        expect(dayAsWritten(' Nov 13, 2026 ')).toEqual(day(2026, 11, 13));
    });

    it('is null for text that isn\'t a date, an impossible day or a date with more after it', () => {
        for (const text of ['soon', 'day 3', '2026-11-31', '2026-11-131', '2026-11-13 (&q=London)', 'tomorrow']) expect(dayAsWritten(text), text).toBeNull();
    });
});
