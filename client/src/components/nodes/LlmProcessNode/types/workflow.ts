/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";
import {MessageRole} from "../../../../types/ollama.types";


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

export type LlmProcessNode = Node<BaseNodeData & LlmProcessNodeData> & { type: typeof NODE_TYPE };