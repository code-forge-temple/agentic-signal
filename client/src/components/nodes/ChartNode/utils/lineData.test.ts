/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {randomColor, toLineData} from './lineData';
import {ChartData, ChartDataset} from '../types/input.types';


const COLOR = /^rgb\((\d+),(\d+),(\d+)\)$/;
const isColor = (value: unknown) => typeof value === 'string' && COLOR.test(value);

// One line: the data, the label, random colors, and a curve.
function expectLine (dataset: ChartDataset | undefined, data: number[], label = 'Sales') {
    expect(dataset).toMatchObject({label, data, tension: 0.4});
    expect(isColor(dataset?.borderColor) && isColor(dataset?.backgroundColor)).toBe(true);
}

describe('toLineData', () => {
    it('keeps Chart.js data, giving a dataset without colors random ones, and keeps the title', () => {
        const input = {labels: ['a', 'b'], datasets: [{label: 'One', data: [1, 2], borderColor: 'red'}, {data: [3, 4]}], title: 'Chart'};
        const result = toLineData(input, 'Sales');
        const [first, second] = result?.datasets ?? [];

        expect(result?.labels).toEqual(['a', 'b']);
        expect(result?.title).toBe('Chart');
        expect(first).toMatchObject({label: 'One', data: [1, 2], borderColor: 'red'});
        expect(isColor(first?.backgroundColor)).toBe(true);
        expect(second?.data).toEqual([3, 4]);
        expect(isColor(second?.borderColor) && isColor(second?.backgroundColor)).toBe(true);
    });

    it('draws labels with one data array as one line named after the node, and keeps the title', () => {
        const result = toLineData({labels: ['a', 'b'], data: [5, 6], title: 'T'}, 'Sales');

        expect(result?.labels).toEqual(['a', 'b']);
        expect(result?.title).toBe('T');
        expectLine(result?.datasets[0], [5, 6]);
        expect(toLineData({labels: ['a'], data: [5]}, 'Sales')).not.toHaveProperty('title');
    });

    it('draws points by x, and numbers by position', () => {
        const points = toLineData([{x: 'Mon', y: 1}, {x: 'Tue', y: 3}], 'Sales');
        const numbers = toLineData([4, 8, 15], 'Sales');

        expect(points?.labels).toEqual(['Mon', 'Tue']);
        expectLine(points?.datasets[0], [1, 3]);
        expect(numbers?.labels).toEqual([0, 1, 2]);
        expectLine(numbers?.datasets[0], [4, 8, 15]);
    });

    it('names a line "Line" when the node has no title', () => {
        expect(toLineData([1, 2], '')?.datasets[0].label).toBe('Line');
    });

    it('gives nothing for no input, an empty array, or an unknown shape', () => {
        expect(toLineData(null, 'Sales')).toBeUndefined();
        expect(toLineData([], 'Sales')).toBeUndefined();
        expect(toLineData([['nested']] as unknown as ChartData, 'Sales')).toBeUndefined();
        expect(toLineData({labels: []} as unknown as ChartData, 'Sales')).toBeUndefined();
    });
});

describe('randomColor', () => {
    it('keeps each channel between 30 and 229', () => {
        for (let attempt = 0; attempt < 50; attempt++) {
            const channels = COLOR.exec(randomColor())!.slice(1).map(Number);

            expect(channels.every(channel => channel >= 30 && channel <= 229)).toBe(true);
        }
    });
});
