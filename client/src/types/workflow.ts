/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Edge as ReactFlowEdge} from '@xyflow/react';


export type GenericNodeData = {
    title: string;
    input?: any;
    feedback?: string;
    timerTrigger?: number;
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
