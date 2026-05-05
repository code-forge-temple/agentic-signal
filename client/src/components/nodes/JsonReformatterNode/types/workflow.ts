/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const JsonReformatterNodeDataSchema = z.object({
    jsonataExpression: z.string().describe("JSONata expression used to transform/reformat the input JSON"),
});

export type JsonReformatterNodeData = z.infer<typeof JsonReformatterNodeDataSchema>;

export function assertIsJsonReformatterNodeData (data: unknown): asserts data is JsonReformatterNodeData {
    JsonReformatterNodeDataSchema.parse(data);
}

export type JsonReformatterNode = Node<BaseNodeData & JsonReformatterNodeData> & { type: typeof NODE_TYPE };