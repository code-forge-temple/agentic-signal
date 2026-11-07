/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const WorkflowInputNodeDataSchema = z.object({
    // eslint-disable-next-line max-len
    command: z.string().describe("The command that starts the workflow: lowercase letters, digits and hyphens, e.g. \"research\". Called as /research in the AI Buddy chat, or with POST /workflows/research from outside."),
    description: z.string().optional().describe("What the command does, shown in the AI Buddy chat's command list and to outside apps listing the commands."),
});

export type WorkflowInputNodeData = z.infer<typeof WorkflowInputNodeDataSchema>;

export function assertIsWorkflowInputNodeData (data: unknown): asserts data is WorkflowInputNodeData {
    WorkflowInputNodeDataSchema.parse(data);
}

export type WorkflowInputNode = Node<BaseNodeData & WorkflowInputNodeData> & { type: typeof NODE_TYPE };
