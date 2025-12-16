/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from '../../../../types/workflow';
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type ChartNodeData = object;

export function assertIsChartNodeData (data: unknown): asserts data is ChartNodeData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Node data is not ChartNodeData');
    }
}

export type ChartNode = Node<BaseNodeData & ChartNodeData> & { type: typeof NODE_TYPE };