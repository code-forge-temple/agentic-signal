/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {ToolNode as component} from "./ToolNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsToolNodeData, ToolNode, ToolNodeDataSchema} from "./types/workflow";


export const ToolNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, ToolNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: "AI Tool",
    assertion: assertIsToolNodeData,
    metadata: {
        description: "Wraps a registered tool (e.g. web search, date/time) and exposes it to an adjacent LlmProcessNode for function calling.",
        ports: {
            tool: true,
        },
        configSchema: ToolNodeDataSchema,
    },
    defaultData: {
        title: "AI Tool",
        toolSubtype: "",
        toolSchema: {} as any,
        userConfig: {},
        handler: undefined,
        toSanitize: ["input", "handler", "toolSchema"]
    }
};