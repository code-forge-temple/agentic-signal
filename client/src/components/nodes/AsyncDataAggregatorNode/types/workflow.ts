/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const AsyncDataAggregatorNodeDataSchema = z.object({});

export type AsyncDataAggregatorNodeData = z.infer<typeof AsyncDataAggregatorNodeDataSchema>;

export function assertIsAsyncDataAggregatorNodeData (data: unknown): asserts data is AsyncDataAggregatorNodeData {
    AsyncDataAggregatorNodeDataSchema.parse(data);
}

export type AsyncDataAggregatorNode = Node<BaseNodeData & AsyncDataAggregatorNodeData> & { type: typeof NODE_TYPE };
