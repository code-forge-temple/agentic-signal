/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";
import {ToolSchema} from "../../../../types/ollama.types";


export type ToolNodeData = {
    toolSubtype: string;
    toolSchema: ToolSchema;
    handler?: (params: any) => Promise<any>;
    userConfig?: Record<string, any>;
};

export function assertIsToolNodeData (data: unknown): asserts data is ToolNodeData {
    if (typeof data !== 'object' || data === null ||
        !('toolSubtype' in data) || typeof data.toolSubtype !== 'string' ||
        !('toolSchema' in data) || typeof data.toolSchema !== 'object'
    ) {
        throw new Error('Node data is not ToolNodeData');
    }

    // handler is optional, but if present, must be a function
    if ('handler' in data && data.handler !== undefined && typeof data.handler !== 'function') {
        throw new Error('Node data handler must be a function if provided');
    }
}

export type ToolNode = Node<BaseNodeData & ToolNodeData> & { type: typeof NODE_TYPE };