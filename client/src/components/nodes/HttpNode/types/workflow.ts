/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type HttpNodeData = {
    url: string;
};

export function assertIsHttpNodeData (data: unknown): asserts data is HttpNodeData {
    if (typeof data !== 'object' || data === null ||
        !('url' in data) || typeof data.url !== 'string') {
        throw new Error('Node data is not HttpNodeData');
    }
}

export type HttpNode = Node<BaseNodeData & HttpNodeData> & { type: typeof NODE_TYPE };