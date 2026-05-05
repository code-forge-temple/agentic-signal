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
    schema: z.string().describe("JSON Schema string used to validate the incoming data"),
});

export type DataValidationNodeData = z.infer<typeof DataValidationNodeDataSchema>;

export function assertIsDataValidationNodeData (data: unknown): asserts data is DataValidationNodeData {
    DataValidationNodeDataSchema.parse(data);
}

export type DataValidationNode = Node<BaseNodeData & DataValidationNodeData> & { type: typeof NODE_TYPE };