/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CandlestickChart} from "iconoir-react";
import {ToolDefinition} from "../types";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";
import {computeIndicators} from "../../../StockAnalysisNode/utils";
import {isStockDataPointArray, StockDataPoint} from "../../../StockAnalysisNode/types/workflow";


export const StockAnalysisToolDescriptor: ToolDefinition = {
    toolSubtype: "stock-analysis",
    title: "Stock Analysis Tool",
    icon: <CandlestickChart />,
    toolSchema: {
        name: "stockAnalysis",
        description: "Analyzes stock historical data and computes technical indicators (SMA, volatility, trend, etc).",
        parameters: {
            type: "object",
            properties: {
                symbol: {
                    type: "string",
                    description: "Stock symbol (e.g., 'AAPL', 'GOOG', 'MSFT')."
                },
                data: {
                    type: "array",
                    description: "Array of historical OHLCV data points (timestamp, open, high, low, close, volume required).",
                    items: {
                        type: "object",
                        properties: {
                            timestamp: {type: "string", description: "ISO date/time string"},
                            open: {type: "number", description: "Opening price"},
                            high: {type: "number", description: "Highest price"},
                            low: {type: "number", description: "Lowest price"},
                            close: {type: "number", description: "Closing price"},
                            volume: {type: "number", description: "Volume"}
                        },
                        required: ["timestamp", "open", "high", "low", "close", "volume"]
                    }
                }
            },
            required: ["symbol", "data"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({}), // No extra config for now
    toSanitize: [],
    handlerFactory: () => async ({symbol, data}: {symbol: string, data: StockDataPoint[]}) => {
        if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
            return {error: "Stock symbol must be specified."};
        }

        if (!isStockDataPointArray(data) || data.length < 10) {
            return {error: "Data array must have at least 10 points."};
        }

        try {
            const result = computeIndicators(data);

            return {
                symbol,
                ...result
            };
        } catch (err) {
            return {error: err instanceof Error ? err.message : String(err)};
        }
    }
};
