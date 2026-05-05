/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from '../../../../types/workflow';
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const ChartNodeDataSchema = z.object({});

export type ChartNodeData = z.infer<typeof ChartNodeDataSchema>;

export function assertIsChartNodeData (data: unknown): asserts data is ChartNodeData {
    ChartNodeDataSchema.parse(data);
}

export type ChartNode = Node<BaseNodeData & ChartNodeData> & { type: typeof NODE_TYPE };