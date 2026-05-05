/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NODE_PORT_IDS} from "../../../constants";
import {NodeDescriptor} from "../types";
import {TimerNode as component} from "./TimerNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsTimerNodeData, defaultTimerNodeData, TIMER_NODE_MODES, TimerNode, TimerConfigSchema} from "./types/workflow";


const defaultIntervalTimerNodeData = defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL];

export const TimerNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, TimerNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    metadata: {
        description: "Triggers downstream nodes on a schedule. Supports fixed interval or cron expression modes.",
        ports: {
            [NODE_PORT_IDS.TRIGGER]: true,
        },
        configSchema: TimerConfigSchema,
    },
    assertion: assertIsTimerNodeData,
    defaultData: {
        title: TITLE,
        ...defaultIntervalTimerNodeData,
        toSanitize: ["input"],
    }
};