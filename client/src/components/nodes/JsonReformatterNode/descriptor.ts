/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {JsonReformatterNode as component} from "./JsonReformatterNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsJsonReformatterNodeData, JsonReformatterNode} from "./types/workflow";


export const JsonReformatterNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, JsonReformatterNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: "JSON Reformatter",
    assertion: assertIsJsonReformatterNodeData,
    defaultData: {
        title: "JSON Reformatter",
        jsonataExpression: "",
        toSanitize: ["input"],
    }
};