/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {HttpNode as component} from "./HttpNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsHttpNodeData, HttpNode} from "./types/workflow";


export const HttpNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, HttpNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsHttpNodeData,
    defaultData: {
        title: TITLE,
        url: "",
        toSanitize: ["input"],
    }
};