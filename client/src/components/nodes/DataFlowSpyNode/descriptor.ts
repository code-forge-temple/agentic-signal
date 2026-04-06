/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {DataFlowSpyNode as component} from "./DataFlowSpyNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDataFlowSpyNodeData, DataFlowSpyNode} from "./types/workflow";


export const DataFlowSpyNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataFlowSpyNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDataFlowSpyNodeData,
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};