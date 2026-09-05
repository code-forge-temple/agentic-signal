/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {LlmProcessNode as component} from "./LlmProcessNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsLlmProcessNodeData, defaultLlmProcessNodeData, LlmProcessNode, LlmProcessNodeDataSchema} from "./types/workflow";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const LlmProcessNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, LlmProcessNode> = {
    type: NODE_TYPE,
    order: 11,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsLlmProcessNodeData,
    metadata: {
        // eslint-disable-next-line max-len
        description: "Sends data to an Ollama LLM with a configurable prompt. Supports tool calling, feedback loops, and conversation history. When 'AI Orchestration Mode' is enabled, an AI orchestrator decomposes the input into individual sequential agent tasks and synthesizes a final aggregated response.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: NodeEnvelopeSchema.describe("payload routed to the LLM's context; toolsPayload bypasses the LLM, forwarded directly to connected tools."),
                // eslint-disable-next-line max-len
                outputSchema: z.object({payload: z.any().describe("LLM response and generated output data.")}).describe("toolsPayload is never included — it dies at this node by design."),
            },
            [NODE_PORT_IDS.TRIGGER]: true,
            [NODE_PORT_IDS.CONTEXT]: true,
            [NODE_PORT_IDS.TOOL]: true,
        },
        configSchema: LlmProcessNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        ...defaultLlmProcessNodeData,
        toSanitize: ["input", "conversationHistory", "feedback"],
    }
};