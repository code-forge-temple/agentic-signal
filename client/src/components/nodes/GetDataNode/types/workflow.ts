/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export const FetchDataType = {
    JSON: 'json',
    TEXT: 'text',
    CSV: 'csv',
    XML: 'xml',
    BLOB: 'blob',
    ARRAY_BUFFER: 'arrayBuffer',
} as const;

export type FetchDataType = typeof FetchDataType[keyof typeof FetchDataType];

export type GetDataNodeData = {
    url: string;
    dataType: FetchDataType;
};

export function assertIsGetDataNodeData (data: unknown): asserts data is GetDataNodeData {
    if (typeof data !== 'object' || data === null ||
        !('url' in data) || typeof data.url !== 'string' ||
        !('dataType' in data) || typeof data.dataType !== 'string') {
        throw new Error('Node data is not GetDataNodeData');
    }
}

export type GetDataNode = Node<BaseNodeData & GetDataNodeData> & { type: typeof NODE_TYPE };