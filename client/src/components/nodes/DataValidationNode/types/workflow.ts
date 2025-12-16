/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from '../../../../types/workflow';
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type DataValidationNodeData = {
    schema: string;
};

export function assertIsDataValidationNodeData (data: unknown): asserts data is DataValidationNodeData {
    if (typeof data !== 'object' || data === null ||
    !('schema' in data) || typeof (data as any).schema !== 'string') {
        throw new Error('Node data is not DataValidationNodeData');
    }
}

export type DataValidationNode = Node<BaseNodeData & DataValidationNodeData> & { type: typeof NODE_TYPE };