/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type TimerNodeData = {
    interval: number;
    immediate: boolean;
};

export function assertIsTimerNodeData (data: unknown): asserts data is TimerNodeData {
    if (typeof data !== 'object' || data === null ||
        !('interval' in data) || typeof (data as any).interval !== 'number' ||
        !('immediate' in data) || typeof (data as any).immediate !== 'boolean') {
        throw new Error('Node data is not TimerNodeData');
    }
}

export type TimerNode = Node<BaseNodeData & TimerNodeData> & { type: typeof NODE_TYPE };