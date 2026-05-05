/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {StockAnalysisNode as component} from "./StockAnalysisNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsStockAnalysisNodeData, StockAnalysisNode, StockAnalysisNodeDataSchema} from "./types/workflow";
import {StockAnalysisInputSchema} from "./types/input.types";
import {NODE_PORT_IDS} from "../../../constants";

export const StockAnalysisNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, StockAnalysisNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsStockAnalysisNodeData,
    metadata: {
        description: "Receives stock price data and renders a financial analysis chart with candlestick or line visualisation.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: StockAnalysisInputSchema.describe("Stock symbol and time-series price data input."),
            },
        },
        configSchema: StockAnalysisNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        toSanitize: ["input"]
    }
};
