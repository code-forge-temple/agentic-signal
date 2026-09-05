/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData, NodeEnvelope} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const AsyncDataAggregatorNodeDataSchema = z.object({});

// Unlike every other node, this node's `input` is a per-source accumulator keyed by source
// node id (Record<string, NodeEnvelope>), not a single NodeEnvelope — overridden here (as a
// TS-only addition, not part of the zod schema) so both the assertion below and the exported
// node type narrow it correctly instead of inheriting BaseNodeData's NodeEnvelope shape.
export type AsyncDataAggregatorNodeData = z.infer<typeof AsyncDataAggregatorNodeDataSchema> & {
    input?: Record<string, NodeEnvelope>;
};

export function assertIsAsyncDataAggregatorNodeData (data: unknown): asserts data is AsyncDataAggregatorNodeData {
    AsyncDataAggregatorNodeDataSchema.parse(data);
}

export type AsyncDataAggregatorNode =
    Node<Omit<BaseNodeData, 'input'> & AsyncDataAggregatorNodeData>
    & { type: typeof NODE_TYPE };
