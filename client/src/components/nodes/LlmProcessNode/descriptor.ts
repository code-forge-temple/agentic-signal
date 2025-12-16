/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {LlmProcessNode as component} from "./LlmProcessNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsLlmProcessNodeData, LlmProcessNode} from "./types/workflow";


export const LlmProcessNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, LlmProcessNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: "AI Data Processing",
    assertion: assertIsLlmProcessNodeData,
    defaultData: {
        title: "AI Data Processing",
        model: "",
        prompt: "",
        message: {},
        format: {},
        maxFeedbackLoops: 0,
        conversationHistory: [],
        toSanitize: ["input", "conversationHistory", "feedback"],
    }
};