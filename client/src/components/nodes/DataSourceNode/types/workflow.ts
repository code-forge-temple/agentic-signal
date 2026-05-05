/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const DATA_SOURCE_TYPES = {
    JSON: "json",
    MARKDOWN: "markdown"
} as const;

export type DATA_SOURCE_TYPES = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

export const FileDataSchema = z.object({
    name: z.string(),
    content: z.string(),
});

export type FileData = z.infer<typeof FileDataSchema>;

const JsonDataSourceSchema = z.object({
    type: z.literal('json'),
    value: z.string().describe("Raw JSON string to use as data source"),
});

const FilesDataSourceSchema = z.object({
    type: z.literal('markdown'),
    value: z.object({
        text: z.string().describe("Markdown text content"),
        files: z.array(FileDataSchema).describe("Attached files"),
    }),
});

export type FilesDataSource = z.infer<typeof FilesDataSourceSchema>;

export const DataSourceNodeDataSchema = z.object({
    dataSource: z.discriminatedUnion('type', [JsonDataSourceSchema, FilesDataSourceSchema])
        .describe("The data source — either raw JSON or markdown with optional files"),
});

export type DataSourceNodeData = z.infer<typeof DataSourceNodeDataSchema>;

export function assertIsDataSourceNodeData (data: unknown): asserts data is DataSourceNodeData {
    DataSourceNodeDataSchema.parse(data);
}

export type DataSourceNode = Node<BaseNodeData & DataSourceNodeData> & { type: typeof NODE_TYPE };
