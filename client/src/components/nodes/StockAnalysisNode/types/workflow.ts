/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";


export type StockDataPoint = {
    timestamp: string,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
};

const STOCK_DATA_POINT_KEYS = ["timestamp", "open", "high", "low", "close", "volume"] as const;

const isStockDataPoint = (item: unknown): boolean =>
    typeof item === "object" && item !== null && STOCK_DATA_POINT_KEYS.every(key => key in item);

export const isStockDataPointArray = (data: unknown): data is StockDataPoint[] => Array.isArray(data) && data.every(isStockDataPoint);

import {z} from 'zod';

export const StockAnalysisNodeDataSchema = z.object({});

export type StockAnalysisNodeData = z.infer<typeof StockAnalysisNodeDataSchema>;

export function assertIsStockAnalysisNodeData (data: unknown): asserts data is StockAnalysisNodeData {
    StockAnalysisNodeDataSchema.parse(data);
}

export type StockAnalysisNode = Node<BaseNodeData & StockAnalysisNodeData> & { type: typeof NODE_TYPE };
