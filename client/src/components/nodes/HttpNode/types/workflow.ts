/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const HttpNodeDataSchema = z.object({
    url: z.string().describe("The URL of the page to fetch via headless browser"),
});

export type HttpNodeData = z.infer<typeof HttpNodeDataSchema>;

export function assertIsHttpNodeData (data: unknown): asserts data is HttpNodeData {
    HttpNodeDataSchema.parse(data);
}

export type HttpNode = Node<BaseNodeData & HttpNodeData> & { type: typeof NODE_TYPE };