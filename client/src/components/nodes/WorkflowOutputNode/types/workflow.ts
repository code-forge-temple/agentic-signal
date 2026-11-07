/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const WorkflowOutputNodeDataSchema = z.object({});

export type WorkflowOutputNodeData = z.infer<typeof WorkflowOutputNodeDataSchema>;

export function assertIsWorkflowOutputNodeData (data: unknown): asserts data is WorkflowOutputNodeData {
    WorkflowOutputNodeDataSchema.parse(data);
}

export type WorkflowOutputNode = Node<BaseNodeData & WorkflowOutputNodeData> & { type: typeof NODE_TYPE };
