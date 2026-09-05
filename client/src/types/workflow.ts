/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import type {Edge as ReactFlowEdge} from '@xyflow/react';


export const NodeEnvelopeSchema = z.object({
    payload: z.unknown().describe("Node-determined content, opaque to the framework — not enforced to be an array."),
    toolsPayload: z.unknown().optional().describe("Opaque payload forwarded to connected tools; each node/tool reshapes or drops it independently."),
    timerTrigger: z.number().optional().describe("Set only by TimerNode. Never forwarded/stacked by any other node."),
});

export type NodeEnvelope = {
    payload: unknown;
    toolsPayload?: unknown;
    timerTrigger?: number;
};

export type GenericNodeData = {
    title: string;
    input?: NodeEnvelope;
    feedback?: string;
    toSanitize: string[];
};

export type EnhancedNodeData = {
    onConfigChange: (id: string, config: Record<string, any>) => void;
    onResultUpdate: (id: string, result?: any) => void;
    onFeedbackSend: (id: string, feedback: string) => void;
};

export function assertIsEnhancedNodeData (data: unknown): asserts data is EnhancedNodeData {
    if (typeof data !== 'object' || data === null ||
        !('onConfigChange' in data) || typeof (data as any).onConfigChange !== 'function' ||
        !('onResultUpdate' in data) || typeof (data as any).onResultUpdate !== 'function' ||
        !('onFeedbackSend' in data) || typeof (data as any).onFeedbackSend !== 'function') {
        throw new Error('Node data is not EnhancedNodeData');
    }
}

export type BaseNodeData = GenericNodeData & Partial<EnhancedNodeData>;

export type Edge = ReactFlowEdge;
