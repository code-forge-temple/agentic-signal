/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const TIMER_NODE_TYPE = "timer";

export const TIMER_NODE_MODES = {
    INTERVAL: 'interval',
    SCHEDULED: 'scheduled'
} as const;

export type TIMER_NODE_MODES = typeof TIMER_NODE_MODES[keyof typeof TIMER_NODE_MODES];

export type IntervalTimerConfig = {
    mode: typeof TIMER_NODE_MODES.INTERVAL;
    interval: number;
    immediate: boolean;
    runOnce: boolean;
};

export function assertIsIntervalTimerConfig (data: unknown): asserts data is IntervalTimerConfig {
    if (typeof data !== 'object' || data === null || (data as any).mode !== TIMER_NODE_MODES.INTERVAL) {
        throw new Error('Data is not IntervalTimerConfig');
    }

    if (
        !(TIMER_NODE_MODES.INTERVAL in data) || typeof (data as any).interval !== 'number' ||
        !('immediate' in data) || typeof (data as any).immediate !== 'boolean' ||
        !('runOnce' in data) || typeof (data as any).runOnce !== 'boolean'
    ) {
        throw new Error('Invalid IntervalTimerConfig');
    }
}

export const SCHEDULED_TIMER_REPEATS = {
    ONCE: 'once',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly'
} as const;

export type SCHEDULED_TIMER_REPEATS = typeof SCHEDULED_TIMER_REPEATS[keyof typeof SCHEDULED_TIMER_REPEATS];

export type ScheduledTimerConfig = {
    mode: typeof TIMER_NODE_MODES.SCHEDULED;
    scheduledDateTime: string; // ISO 8601 format
    repeat: SCHEDULED_TIMER_REPEATS;
    timezone?: string;
};

export function assertIsScheduledTimerConfig (data: unknown): asserts data is ScheduledTimerConfig {
    if (typeof data !== 'object' || data === null || (data as any).mode !== TIMER_NODE_MODES.SCHEDULED) {
        throw new Error('Data is not ScheduledTimerConfig');
    }

    if (
        !('scheduledDateTime' in data) || typeof (data as any).scheduledDateTime !== 'string' ||
        !('repeat' in data) || !Object.values(SCHEDULED_TIMER_REPEATS).includes((data as any).repeat)
    ) {
        throw new Error('Invalid ScheduledTimerConfig');
    }
}

export type TimerConfig = IntervalTimerConfig | ScheduledTimerConfig;

export type TimerTriggerEvent = {
    nodeId: string;
    timestamp: number;
    type: TIMER_NODE_MODES;
};

export const TimerTriggerEventFields = {
    nodeId: "String",
    timestamp: "Float",
    type: "String"
};

export const isTimerTriggerEvent = (obj: any): obj is TimerTriggerEvent => {
    return (
        typeof obj === 'object' && obj !== null &&
        typeof obj.nodeId === 'string' &&
        typeof obj.timestamp === 'number' &&
        typeof obj.type === 'string' &&
        Object.values(TIMER_NODE_MODES).includes(obj.type)
    );
}