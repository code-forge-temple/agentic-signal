/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";


export const DATA_SOURCE_TYPES = {
    JSON: "json",
    MARKDOWN: "markdown"
} as const;

export type DATA_SOURCE_TYPES = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

type JsonDataSource = {
    type: typeof DATA_SOURCE_TYPES.JSON,
    value: string
};

export type FileData = {
    name: string;
    content: string;
}

export type FilesDataSource = {
    type: typeof DATA_SOURCE_TYPES.MARKDOWN,
    value: {
        text: string;
        files: FileData[]
    }
};


export type DataSourceNodeData = {
    dataSource: JsonDataSource | FilesDataSource
};

export function assertIsDataSourceNodeData (data: unknown): asserts data is DataSourceNodeData {
    if (
        typeof data !== 'object' ||
        data === null ||
        !('dataSource' in data) ||
        typeof (data as any).dataSource !== 'object' ||
        (data as any).dataSource === null ||
        !('type' in (data as any).dataSource)
    ) {
        throw new Error('Node data is not DataSourceNodeData');
    }

    const ds = (data as any).dataSource;

    if (ds.type === DATA_SOURCE_TYPES.JSON) {
        if (!('value' in ds) || typeof ds.value !== 'string') {
            throw new Error('Node data is not DataSourceNodeData');
        }
    } else if (ds.type === DATA_SOURCE_TYPES.MARKDOWN) {
        if (
            !('value' in ds) ||
            typeof ds.value !== 'object' ||
            ds.value === null ||
            !('text' in ds.value) ||
            typeof ds.value.text !== 'string' ||
            !('files' in ds.value) ||
            !Array.isArray(ds.value.files)
        ) {
            throw new Error('Node data is not DataSourceNodeData');
        }
    } else {
        throw new Error('Node data is not DataSourceNodeData');
    }
}

export type DataSourceNode = Node<BaseNodeData & DataSourceNodeData> & { type: typeof NODE_TYPE };
