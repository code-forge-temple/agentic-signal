/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {ChartNode as component} from "./ChartNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsChartNodeData, ChartNode, ChartNodeDataSchema} from "./types/workflow";
import {ChartDataSchema} from "./types/input.types";
import {NODE_PORT_IDS} from "../../../constants";


export const ChartNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, ChartNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsChartNodeData,
    metadata: {
        description: "Renders a chart from incoming data. Expects chart configuration in Chart.js format.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: ChartDataSchema.describe("Incoming chart data and configuration in Chart.js format."),
            },
        },
        configSchema: ChartNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};