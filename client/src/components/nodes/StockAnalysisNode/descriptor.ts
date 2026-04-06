/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {StockAnalysisNode as component} from "./StockAnalysisNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsStockAnalysisNodeData, StockAnalysisNode} from "./types/workflow";

export const StockAnalysisNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, StockAnalysisNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsStockAnalysisNodeData,
    defaultData: {
        title: TITLE,
        toSanitize: ["input"]
    }
};
