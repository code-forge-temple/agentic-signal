/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const DataFlowSpyNodeDataSchema = z.object({});

export type DataFlowSpyNodeData = z.infer<typeof DataFlowSpyNodeDataSchema>;

export function assertIsDataFlowSpyNodeData (data: unknown): asserts data is DataFlowSpyNodeData {
    DataFlowSpyNodeDataSchema.parse(data);
}

export type DataFlowSpyNode = Node<BaseNodeData & DataFlowSpyNodeData> & { type: typeof NODE_TYPE };
