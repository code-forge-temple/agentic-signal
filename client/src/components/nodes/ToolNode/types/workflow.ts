/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {ToolSchema} from "../../../../types/ollama.types";
import {z} from 'zod';


// handler and toolSchema are runtime-injected; only toolSubtype and userConfig are user-configurable
export const ToolNodeDataSchema = z.object({
    toolSubtype: z.string().describe("Identifier of the specific tool to use (e.g. 'brave-search', 'datetime-now')"),
    userConfig: z.record(z.any()).optional().describe("Tool-specific user configuration values (API keys, settings, etc.)"),
    handler: z.function().optional(),
});

export type ToolNodeData = z.infer<typeof ToolNodeDataSchema> & {
    toolSchema: ToolSchema;
};

export function assertIsToolNodeData (data: unknown): asserts data is ToolNodeData {
    ToolNodeDataSchema.parse(data);
}

export type ToolNode = Node<BaseNodeData & ToolNodeData> & { type: typeof NODE_TYPE };