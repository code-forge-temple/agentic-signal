/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {TimerNode as component} from "./TimerNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsTimerNodeData, defaultTimerNodeData, TIMER_NODE_MODES, TimerNode} from "./types/workflow";


const defaultIntervalTimerNodeData = defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL];

export const TimerNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, TimerNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: "Timer",
    assertion: assertIsTimerNodeData,
    defaultData: {
        title: "Timer",
        ...defaultIntervalTimerNodeData,
        toSanitize: ["input"],
    }
};