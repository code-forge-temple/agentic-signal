/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {ChartNode as component} from "./ChartNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsChartNodeData, ChartNode} from "./types/workflow";


export const ChartNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, ChartNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: "Display Chart",
    assertion: assertIsChartNodeData,
    defaultData: {
        title: "Display Chart",
        toSanitize: ["input"],
    }
};