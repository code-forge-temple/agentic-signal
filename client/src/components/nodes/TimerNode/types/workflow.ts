/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import {NODE_TYPE} from "../constants";
import {
    assertIsIntervalTimerConfig,
    assertIsScheduledTimerConfig,
    TIMER_NODE_MODES,
    SCHEDULED_TIMER_REPEATS,
    TimerConfig,
    IntervalTimerConfig,
    ScheduledTimerConfig
} from "@shared/types.gen";

export {
    assertIsIntervalTimerConfig,
    assertIsScheduledTimerConfig,
    TIMER_NODE_MODES,
    SCHEDULED_TIMER_REPEATS
};

export {isTimerTriggerEvent} from "@shared/types.gen";

export type {TimerTriggerEvent} from "@shared/types.gen";

export type {IntervalTimerConfig, ScheduledTimerConfig};

export type TimerNodeData = TimerConfig;

export function assertIsTimerNodeData (data: unknown): asserts data is TimerNodeData {
    if (typeof data !== 'object' || data === null || !('mode' in data)) {
        throw new Error('Node data is not TimerNodeData');
    }

    const mode = (data as any).mode;

    if (mode === TIMER_NODE_MODES.INTERVAL) {
        assertIsIntervalTimerConfig(data);
    } else if (mode === TIMER_NODE_MODES.SCHEDULED) {
        assertIsScheduledTimerConfig(data);
    } else {
        throw new Error(`Unknown timer mode: ${mode}`);
    }
}

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