/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {AsyncDataAggregatorNode as component} from "./AsyncDataAggregatorNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsAsyncDataAggregatorNodeData, AsyncDataAggregatorNode, AsyncDataAggregatorNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const AsyncDataAggregatorNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, AsyncDataAggregatorNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsAsyncDataAggregatorNodeData,
    metadata: {
        description: "Collects and aggregates data from multiple upstream nodes before passing it downstream as a combined result.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: z.record(z.any()).describe("Incoming data from upstream nodes, keyed by source node ID."),
                outputSchema: z.array(z.any()).describe("Aggregated output values from connected upstream nodes."),
            },
        },
        configSchema: AsyncDataAggregatorNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};
