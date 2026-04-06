/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type StockDataPoint = {
    timestamp: string,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
};

export const isStockDataPointArray = (data: unknown): data is StockDataPoint[] => {
    return Array.isArray(data) && data.every(item =>
        typeof item === "object" &&
        item !== null &&
        "timestamp" in item &&
        "open" in item &&
        "high" in item &&
        "low" in item &&
        "close" in item &&
        "volume" in item
    );
};

export type StockAnalysisNodeData = object;

export function assertIsStockAnalysisNodeData (data: unknown): asserts data is StockAnalysisNodeData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Node data is not StockAnalysisNodeData');
    }
}

export type StockAnalysisNode = Node<BaseNodeData & StockAnalysisNodeData> & { type: typeof NODE_TYPE };
