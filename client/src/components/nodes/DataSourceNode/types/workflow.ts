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
    MARKDOWN_AND_FILES: "markdown-and-files"
} as const;

export type DATA_SOURCE_TYPES = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES];

export const DATA_SOURCE_TYPE_LABELS: Record<DATA_SOURCE_TYPES, string> = {
    [DATA_SOURCE_TYPES.JSON]: "JSON",
    [DATA_SOURCE_TYPES.MARKDOWN_AND_FILES]: "Markdown & Files",
};

export const FileDataSchema = z.object({
    name: z.string(),
    content: z.string(),
    /** Base64-encoded binary content — present only for binary file types (PDF, DOCX, etc.). */
    base64: z.string().optional(),
    mimeType: z.string().optional(),
    /**
     * When true the file is passed directly to tools as a binary attachment and is NOT
     * embedded in the LLM context. Automatically true for binary file types (PDF, DOCX, …).
     * Undefined means "infer from extension" (backward-compatible with saved workflows).
     */
    isToolsPayload: z.boolean().optional(),
});

export type FileData = z.infer<typeof FileDataSchema>;

const JsonDataSourceSchema = z.object({
    type: z.literal('json'),
    value: z.string().describe("Raw JSON string to use as data source"),
});

const MarkdownAndFilesDataSourceSchema = z.object({
    type: z.literal(DATA_SOURCE_TYPES.MARKDOWN_AND_FILES),
    value: z.object({
        text: z.string().describe("Markdown text content"),
        files: z.array(FileDataSchema).describe("Attached files"),
    }),
});

export type MarkdownAndFilesDataSource = z.infer<typeof MarkdownAndFilesDataSourceSchema>;

export const DataSourceNodeDataSchema = z.object({
    dataSource: z.discriminatedUnion('type', [JsonDataSourceSchema, MarkdownAndFilesDataSourceSchema])
        .describe("The data source — either raw JSON or markdown with optional files"),
});

export type DataSourceNodeData = z.infer<typeof DataSourceNodeDataSchema>;

export function assertIsDataSourceNodeData (data: unknown): asserts data is DataSourceNodeData {
    DataSourceNodeDataSchema.parse(data);
}

export type DataSourceNode = Node<BaseNodeData & DataSourceNodeData> & { type: typeof NODE_TYPE };
