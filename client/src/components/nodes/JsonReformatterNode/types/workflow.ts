/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type JsonReformatterNodeData = {
    jsonataExpression: string;
};

export function assertIsJsonReformatterNodeData (data: unknown): asserts data is JsonReformatterNodeData {
    if (typeof data !== 'object' || data === null ||
    !('jsonataExpression' in data) || typeof (data as any).jsonataExpression !== 'string') {
        throw new Error('Node data is not JsonReformatterNodeData');
    }
}

export type JsonReformatterNode = Node<BaseNodeData & JsonReformatterNodeData> & { type: typeof NODE_TYPE };