/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";

export const TIMER_NODE_TYPE = "timer";

export const TIMER_NODE_MODES = {
    INTERVAL: 'interval',
    SCHEDULED: 'scheduled'
} as const;

export type TIMER_NODE_MODES = typeof TIMER_NODE_MODES[keyof typeof TIMER_NODE_MODES];

export const IntervalTimerConfigSchema = z.object({
    mode: z.literal(TIMER_NODE_MODES.INTERVAL),
    interval: z.number(),
    immediate: z.boolean(),
    runOnce: z.boolean()
});

export type IntervalTimerConfig = z.infer<typeof IntervalTimerConfigSchema>;

export function assertIsIntervalTimerConfig (data: unknown): asserts data is IntervalTimerConfig {
    IntervalTimerConfigSchema.parse(data);
}

export const SCHEDULED_TIMER_REPEATS = {
    ONCE: 'once',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly'
} as const;

export type SCHEDULED_TIMER_REPEATS = typeof SCHEDULED_TIMER_REPEATS[keyof typeof SCHEDULED_TIMER_REPEATS];

export const ScheduledTimerConfigSchema = z.object({
    mode: z.literal(TIMER_NODE_MODES.SCHEDULED),
    scheduledDateTime: z.string(),
    repeat: z.nativeEnum(SCHEDULED_TIMER_REPEATS),
    timezone: z.string().optional()
});

export type ScheduledTimerConfig = z.infer<typeof ScheduledTimerConfigSchema>;

export function assertIsScheduledTimerConfig (data: unknown): asserts data is ScheduledTimerConfig {
    ScheduledTimerConfigSchema.parse(data);
}

export const TimerConfigSchema = z.discriminatedUnion("mode", [
    IntervalTimerConfigSchema,
    ScheduledTimerConfigSchema
]);

export function assertIsTimerConfig (data: unknown): asserts data is TimerConfig {
    TimerConfigSchema.parse(data);
}

export type TimerConfig = z.infer<typeof TimerConfigSchema>;

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

// shared/utils has isObject, but the client compiles this file too (through types.gen), and the two import shared/utils
// differently ("@shared/utils" there, "../../../shared/utils.ts" here): so a copy.
const isObjectLike = (obj: unknown): obj is Record<string, unknown> => typeof obj === 'object' && obj !== null;

const isTimerMode = (type: unknown): boolean => typeof type === 'string' && (Object.values(TIMER_NODE_MODES) as string[]).includes(type);

export const isTimerTriggerEvent = (obj: unknown): obj is TimerTriggerEvent => {
    if (!isObjectLike(obj)) return false;

    return typeof obj.nodeId === 'string' && typeof obj.timestamp === 'number' && isTimerMode(obj.type);
}