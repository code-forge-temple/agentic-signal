/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

export const StockDataPointSchema = z.object({
    timestamp: z.string(),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number()
});

export const StockAnalysisInputSchema = z.object({
    symbol: z.string(),
    data: z.array(StockDataPointSchema)
});

export type StockDataPoint = z.infer<typeof StockDataPointSchema>;

export type StockAnalysisInput = z.infer<typeof StockAnalysisInputSchema>;

export const STOCK_ANALYSIS_INPUT_JSON_SCHEMA = JSON.stringify(zodToJsonSchema(StockAnalysisInputSchema), null, 4);


