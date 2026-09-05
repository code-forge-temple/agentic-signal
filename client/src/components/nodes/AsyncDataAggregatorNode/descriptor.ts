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
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const AsyncDataAggregatorNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, AsyncDataAggregatorNode> = {
    type: NODE_TYPE,
    order: 8,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsAsyncDataAggregatorNodeData,
    metadata: {
        description: "Collects and aggregates data from multiple upstream nodes before passing it downstream as a combined result.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: z.record(NodeEnvelopeSchema).describe("Internal accumulator, keyed by source node ID — not itself an envelope."),
                outputSchema: NodeEnvelopeSchema.extend({
                    payload: z.array(z.any()).describe("Each connected source's payload, in edge order."),
                    // eslint-disable-next-line max-len
                    toolsPayload: z.array(z.any()).describe("Each connected source's toolsPayload, in edge order — always present and the same length as payload, even if every element is undefined, so the two arrays can be zipped positionally."),
                }),
            },
        },
        configSchema: AsyncDataAggregatorNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};
