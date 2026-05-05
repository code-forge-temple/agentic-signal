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
import {NODE_PORT_IDS} from '../../../constants';


export const LlmProcessNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, LlmProcessNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsLlmProcessNodeData,
    metadata: {
        description: "Sends data to an Ollama LLM with a configurable prompt. Supports tool calling, feedback loops, and conversation history.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: z.any().describe("Incoming data, tools, and context for prompt execution."),
                outputSchema: z.any().describe("LLM response and generated output data."),
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