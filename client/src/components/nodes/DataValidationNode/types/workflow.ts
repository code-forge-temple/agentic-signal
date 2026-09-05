/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from '../../../../types/workflow';
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const DataValidationNodeDataSchema = z.object({
    validatePayload: z.boolean().optional()
        .describe("When on (default) or unset, payload is validated against payloadSchema. When off, payload passes through unvalidated."),
    payloadSchema: z.string()
        .describe("JSON Schema string used to validate the incoming payload. Left empty, payload validation is skipped (permissive)."),
    validateToolsPayload: z.boolean().optional()
        .describe("When on, toolsPayload is validated against toolsPayloadSchema. When off/unset, toolsPayload passes through unvalidated."),
    toolsPayloadSchema: z.string().optional()
        .describe("JSON Schema for toolsPayload, used when validateToolsPayload is on. Left empty, toolsPayload validation is skipped."),
});

export type DataValidationNodeData = z.infer<typeof DataValidationNodeDataSchema>;

export function assertIsDataValidationNodeData (data: unknown): asserts data is DataValidationNodeData {
    DataValidationNodeDataSchema.parse(data);
}

export type DataValidationNode = Node<BaseNodeData & DataValidationNodeData> & { type: typeof NODE_TYPE };