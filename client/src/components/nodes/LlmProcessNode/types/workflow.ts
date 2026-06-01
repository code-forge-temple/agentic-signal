/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable max-len */

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';
import {ROLE} from "../../../../constants";


export const LlmProcessNodeDataSchema = z.object({
    model: z.string().describe("Ollama model name to use for LLM processing"),
    prompt: z.string().optional().describe("System prompt to guide the LLM behaviour"),
    format: z.object({
        onSuccess: z.string().optional().describe("JSON Schema string for Ollama structured output on success — constrains the LLM reply shape for successful responses"),
        onError: z.string().optional().describe("JSON Schema string for Ollama structured output on error — constrains the LLM reply shape when the node is handling an error"),
    }).optional().describe("Structured output schemas passed to Ollama to constrain LLM response format"),
    message: z.object({
        prefix: z.string().optional().describe("Text prepended to the user message before sending to the LLM"),
        suffix: z.string().optional().describe("Text appended to the user message before sending to the LLM"),
    }).optional().describe("Message wrapper applied around the incoming data"),
    maxFeedbackLoops: z.number().int().nonnegative().describe("Maximum number of feedback iterations before stopping"),
    maxToolRetries: z.number().int().nonnegative().describe("Maximum number of retries when a tool call fails"),
    conversationHistory: z.array(z.object({
        role: z.enum([ROLE.SYSTEM, ROLE.USER, ROLE.ASSISTANT]),
        content: z.string(),
    })).optional().describe("Retained conversation history for multi-turn interactions"),
    think: z.boolean().optional().describe("Enable thinking mode for supported models (e.g. deepseek-r1)"),
    temperatureEnabled: z.boolean().optional().describe("Whether to override the default model temperature"),
    temperature: z.number().min(0).max(2).optional().default(0.8).describe("Sampling temperature (0 = deterministic, 2 = very random)"),
    orchestrationMode: z.boolean().optional().describe("When enabled, an AI orchestrator decomposes the input (string or array) into individual agent tasks, runs them sequentially, then synthesizes a final aggregated response"),
});

export type LlmProcessNodeData = z.infer<typeof LlmProcessNodeDataSchema>;

export function assertIsLlmProcessNodeData (data: unknown): asserts data is LlmProcessNodeData {
    LlmProcessNodeDataSchema.parse(data);
}

export type LlmProcessNode = Node<BaseNodeData & LlmProcessNodeData> & { type: typeof NODE_TYPE };

export const defaultLlmProcessNodeData: LlmProcessNodeData = {
    model: "",
    prompt: "",
    message: undefined,
    format: {},
    maxFeedbackLoops: 0,
    maxToolRetries: 3,
    conversationHistory: [],
    think: false,
    temperatureEnabled: false,
    temperature: 0.8,
    orchestrationMode: false,
}