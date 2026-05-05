/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const FetchDataType = {
    JSON: 'json',
    TEXT: 'text',
    CSV: 'csv',
    XML: 'xml',
    BLOB: 'blob',
    ARRAY_BUFFER: 'arrayBuffer',
} as const;

export type FetchDataType = typeof FetchDataType[keyof typeof FetchDataType];

export const GetDataNodeDataSchema = z.object({
    url: z.string().describe("The URL to fetch data from"),
    dataType: z.enum(['json', 'text', 'csv', 'xml', 'blob', 'arrayBuffer']).describe("Expected format of the fetched data"),
    dataProvidedByUpstream: z.boolean().describe("When true, data content ('url', 'dataType') is provided by an upstream node instead of being configured here"),
});

export type GetDataNodeData = z.infer<typeof GetDataNodeDataSchema>;

export function assertIsGetDataNodeData (data: unknown): asserts data is GetDataNodeData {
    GetDataNodeDataSchema.parse(data);
}

export type GetDataNode = Node<BaseNodeData & GetDataNodeData> & { type: typeof NODE_TYPE };