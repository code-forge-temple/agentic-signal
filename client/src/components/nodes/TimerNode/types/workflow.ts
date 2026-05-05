/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {
    assertIsIntervalTimerConfig,
    assertIsScheduledTimerConfig,
    assertIsTimerConfig,
    TIMER_NODE_MODES,
    SCHEDULED_TIMER_REPEATS,
    TimerConfig,
    IntervalTimerConfig,
    ScheduledTimerConfig,
    TimerConfigSchema as SharedTimerConfigSchema
} from "@shared/types.gen";

export {
    assertIsIntervalTimerConfig,
    assertIsScheduledTimerConfig,
    assertIsTimerConfig,
    TIMER_NODE_MODES,
    SCHEDULED_TIMER_REPEATS
};

export {isTimerTriggerEvent} from "@shared/types.gen";

export const TimerConfigSchema: z.ZodTypeAny = SharedTimerConfigSchema as unknown as z.ZodTypeAny;

export {assertIsTimerConfig as assertIsTimerNodeData} from "@shared/types.gen";

export type {TimerTriggerEvent} from "@shared/types.gen";

export type {IntervalTimerConfig, ScheduledTimerConfig};

export type TimerNodeData = TimerConfig;

export type TimerNode = Node<BaseNodeData & TimerNodeData> & { type: typeof NODE_TYPE };

type DefaultTimerNodeData = {
    [TIMER_NODE_MODES.INTERVAL]: IntervalTimerConfig;
    [TIMER_NODE_MODES.SCHEDULED]: ScheduledTimerConfig;
};

export const defaultTimerNodeData: DefaultTimerNodeData = {
    [TIMER_NODE_MODES.INTERVAL]: {
        mode: TIMER_NODE_MODES.INTERVAL,
        interval: 60,
        immediate: false,
        runOnce: true
    },
    [TIMER_NODE_MODES.SCHEDULED]: {
        mode: TIMER_NODE_MODES.SCHEDULED,
        scheduledDateTime: new Date().toISOString(),
        repeat: SCHEDULED_TIMER_REPEATS.ONCE
    }
};