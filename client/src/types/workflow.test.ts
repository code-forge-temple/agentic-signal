/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {assertIsEnhancedNodeData} from './workflow';
import {isStockDataPointArray} from '../components/nodes/StockAnalysisNode/types/workflow';


describe('assertIsEnhancedNodeData', () => {
    const fn = () => {};
    const data = {onConfigChange: fn, onResultUpdate: fn, onFeedbackSend: fn};

    it('accepts node data with the three callbacks', () => {
        expect(() => assertIsEnhancedNodeData({...data, title: 'x'})).not.toThrow();
        expect(() => assertIsEnhancedNodeData(Object.create(data))).not.toThrow();
    });

    it('refuses anything else', () => {
        const others = [null, undefined, 'x', 1, {}, {...data, onConfigChange: 'no'}, {...data, onResultUpdate: undefined}, {onConfigChange: fn, onResultUpdate: fn}];

        for (const value of others) expect(() => assertIsEnhancedNodeData(value)).toThrow('Node data is not EnhancedNodeData');
    });
});

describe('isStockDataPointArray', () => {
    const point = {timestamp: 't', open: 1, high: 2, low: 0, close: 1, volume: 5};

    it('is a list whose items have every field (whatever their values), an empty list too', () => {
        expect(isStockDataPointArray([point, {...point, open: 'x', extra: 1}])).toBe(true);
        expect(isStockDataPointArray([])).toBe(true);
    });

    it('is not a list missing a field in any item, with a non-object, or no list at all', () => {
        for (const key of Object.keys(point)) {
            const missing: Record<string, unknown> = {...point};

            delete missing[key];
            expect(isStockDataPointArray([point, missing]), key).toBe(false);
        }

        for (const value of [[null], [1], ['x'], point, null, 'x']) expect(isStockDataPointArray(value)).toBe(false);
    });
});
