/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Node, Edge as ReactFlowEdge} from '@xyflow/react';
import {FetchDataType, TaskNodeType} from '../constants';
import {MessageRole, ToolSchema} from './ollama.types';


export type GenericNodeData = {
    title: string;
    input?: any;
    feedback?: string;
};

type EnhancedNodeData = {
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

export type GetDataNodeData = {
    url: string;
    dataType: FetchDataType;
};

export function assertIsGetDataNodeData (data: unknown): asserts data is GetDataNodeData {
    if (typeof data !== 'object' || data === null ||
        !('url' in data) || typeof data.url !== 'string' ||
        !('dataType' in data) || typeof data.dataType !== 'string') {
        throw new Error('Node data is not GetDataNodeData');
    }
}

export type HttpNodeData = {
    url: string;
};

export function assertIsHttpNodeData (data: unknown): asserts data is HttpNodeData {
    if (typeof data !== 'object' || data === null ||
        !('url' in data) || typeof data.url !== 'string') {
        throw new Error('Node data is not HttpNodeData');
    }
}

export type LlmProcessNodeData = {
    format?: {onSuccess?: string; onError?: string;};
    model: string;
    prompt?: string;
    message?: {
        preffix?: string;
        suffix?: string;
    };
    maxFeedbackLoops: number;
    conversationHistory?: Array<{
        role: MessageRole;
        content: string;
    }>;
};

export function assertIsLlmProcessNodeData (data: unknown): asserts data is LlmProcessNodeData {
    if (typeof data !== 'object' || data === null ||
        !('model' in data) || typeof data.model !== 'string') {
        throw new Error('Node data is not LlmProcessNodeData');
    }

    // Validate format field if present
    if ('format' in data && data.format !== undefined) {
        if (typeof data.format !== 'object' || data.format === null) {
            throw new Error('Node data format must be an object if provided');
        }

        if ('onSuccess' in data.format && data.format.onSuccess !== undefined && typeof data.format.onSuccess !== 'string') {
            throw new Error('Node data format.onSuccess must be a string if provided');
        }

        if ('onError' in data.format && data.format.onError !== undefined && typeof data.format.onError !== 'string') {
            throw new Error('Node data format.onError must be a string if provided');
        }
    }

    // Validate prompt field if present
    if ('prompt' in data && data.prompt !== undefined && typeof data.prompt !== 'string') {
        throw new Error('Node data prompt must be a string if provided');
    }

    // Validate message field if present
    if ('message' in data && data.message !== undefined) {
        if (typeof data.message !== 'object' || data.message === null) {
            throw new Error('Node data message must be an object if provided');
        }

        // Validate message properties
        if ('preffix' in data.message && data.message.preffix !== undefined && typeof data.message.preffix !== 'string') {
            throw new Error('Node data message.preffix must be a string if provided');
        }

        if ('suffix' in data.message && data.message.suffix !== undefined && typeof data.message.suffix !== 'string') {
            throw new Error('Node data message.suffix must be a string if provided');
        }
    }

    // Validate maxFeedbackLoops field if present
    if ('maxFeedbackLoops' in data && data.maxFeedbackLoops !== undefined && typeof data.maxFeedbackLoops !== 'number') {
        throw new Error('Node data maxFeedbackLoops must be a number if provided');
    }

    // Validate conversationHistory field if present
    if ('conversationHistory' in data && data.conversationHistory !== undefined) {
        if (!Array.isArray(data.conversationHistory)) {
            throw new Error('Node data conversationHistory must be an array if provided');
        }

        // Validate each message in the conversation history
        data.conversationHistory.forEach((message, index) => {
            if (typeof message !== 'object' || message === null) {
                throw new Error(`Node data conversationHistory[${index}] must be an object`);
            }

            if (!('role' in message) || typeof message.role !== 'string') {
                throw new Error(`Node data conversationHistory[${index}].role must be a string`);
            }

            if (message.role !== MessageRole.SYSTEM && message.role !== MessageRole.USER && message.role !== MessageRole.ASSISTANT) {
                throw new Error(`Node data conversationHistory[${index}].role must be one of ${Object.values(MessageRole).join(', ')}`);
            }

            if (!('content' in message) || typeof message.content !== 'string') {
                throw new Error(`Node data conversationHistory[${index}].content must be a string`);
            }
        });
    }
}

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

export type DataFlowSpyNodeData = BaseNodeData;

export function assertIsDataFlowSpyNodeData (data: unknown): asserts data is DataFlowSpyNodeData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Node data is not DataFlowSpyNodeData');
    }
}

export type DataSourceNodeData = {
    dataSource: {
        value: string,
        type: "json" | "text"
    }
};

export function assertIsDataSourceNodeData (data: unknown): asserts data is DataSourceNodeData {
    if (typeof data !== 'object' || data === null ||
        !('dataSource' in data) || !(typeof data.dataSource === 'object') || data.dataSource === null ||
        !('value' in data.dataSource) || typeof data.dataSource.value !== 'string' ||
        !('type' in data.dataSource) || (data.dataSource.type !== 'json' && data.dataSource.type !== 'text')) {
        throw new Error('Node data is not DataSourceNodeData');
    }
}

export type ChartNodeData = BaseNodeData;

export function assertIsChartNodeData (data: unknown): asserts data is ChartNodeData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Node data is not ChartNodeData');
    }
}

export type JsonReformatterNodeData = {
    jsonataExpression: string;
};

export function assertIsJsonReformatterNodeData (data: unknown): asserts data is JsonReformatterNodeData {
    if (typeof data !== 'object' || data === null ||
    !('jsonataExpression' in data) || typeof (data as any).jsonataExpression !== 'string') {
        throw new Error('Node data is not JsonReformatterNodeData');
    }
}

export type DataValidationNodeData = {
    schema: string;
};

export function assertIsDataValidationNodeData (data: unknown): asserts data is DataValidationNodeData {
    if (typeof data !== 'object' || data === null ||
    !('schema' in data) || typeof (data as any).schema !== 'string') {
        throw new Error('Node data is not DataValidationNodeData');
    }
}

export type GetDataNode = Node<BaseNodeData & GetDataNodeData> & { type: typeof TaskNodeType.GET_DATA };

export type LlmProcessNode = Node<BaseNodeData & LlmProcessNodeData> & { type: typeof TaskNodeType.LLM_PROCESS };

export type ChartNode = Node<BaseNodeData & ChartNodeData> & { type: typeof TaskNodeType.CHART };

export type DataSourceNode = Node<BaseNodeData & DataSourceNodeData> & { type: typeof TaskNodeType.DATA_SOURCE };

export type JsonReformatterNode = Node<BaseNodeData & JsonReformatterNodeData> & { type: typeof TaskNodeType.JSON_REFORMATTER };

export type DataFlowSpyNode = Node<BaseNodeData & DataFlowSpyNodeData> & { type: typeof TaskNodeType.DATA_FLOW_SPY };

export type HttpNode = Node<BaseNodeData & HttpNodeData> & { type: typeof TaskNodeType.HTTP_DATA };

export type ToolNode = Node<BaseNodeData & ToolNodeData> & { type: typeof TaskNodeType.AI_TOOL };

export type DataValidationNode = Node<BaseNodeData & DataValidationNodeData> & { type: typeof TaskNodeType.DATA_VALIDATION };

export type AppNode =
    | GetDataNode
    | LlmProcessNode
    | ChartNode
    | DataSourceNode
    | JsonReformatterNode
    | DataFlowSpyNode
    | HttpNode
    | ToolNode
    | DataValidationNode;

export type Edge = ReactFlowEdge;