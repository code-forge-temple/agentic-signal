/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export type DataSourceNodeData = {
    dataSource: {
        value: string,
        type: "json" | "text"
    }
};

export function assertIsDataSourceNodeData (data: unknown): asserts data is DataSourceNodeData {
    if (typeof data !== 'object' || data === null ||
        !('dataSource' in data) || !(typeof data.dataSource === 'object') || data.dataSource === null ||
        !('value' in data.dataSource) || typeof data.dataSource.value !== 'string' ||
        !('type' in data.dataSource) || (data.dataSource.type !== 'json' && data.dataSource.type !== 'text')) {
        throw new Error('Node data is not DataSourceNodeData');
    }
}

export type DataSourceNode = Node<BaseNodeData & DataSourceNodeData> & { type: typeof NODE_TYPE };
