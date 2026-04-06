/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {AsyncDataAggregatorNode as component} from "./AsyncDataAggregatorNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsAsyncDataAggregatorNodeData, AsyncDataAggregatorNode} from "./types/workflow";


export const AsyncDataAggregatorNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, AsyncDataAggregatorNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsAsyncDataAggregatorNodeData,
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};
