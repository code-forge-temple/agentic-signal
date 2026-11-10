/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {
    defaultTimerNodeData,
    IntervalTimerConfig,
    SCHEDULED_TIMER_REPEATS,
    ScheduledTimerConfig,
    TIMER_NODE_MODES,
    TimerNodeData,
} from "../types/workflow";


const INTERVAL_DEFAULTS = defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL];
const SCHEDULED_DEFAULTS = defaultTimerNodeData[TIMER_NODE_MODES.SCHEDULED];

/** Every setting a timer can have: the current mode's own, and the other mode's defaults. */
export type TimerSettings = Omit<IntervalTimerConfig, "mode"> & Omit<ScheduledTimerConfig, "mode"> & {mode: TimerNodeData["mode"]};

function intervalSettings (data: TimerNodeData): Omit<IntervalTimerConfig, "mode"> {
    if (data.mode !== TIMER_NODE_MODES.INTERVAL) return INTERVAL_DEFAULTS;

    return {
        interval: data.interval ?? INTERVAL_DEFAULTS.interval,
        immediate: data.immediate ?? INTERVAL_DEFAULTS.immediate,
        runOnce: data.runOnce ?? INTERVAL_DEFAULTS.runOnce,
    };
}

function scheduledSettings (data: TimerNodeData): Omit<ScheduledTimerConfig, "mode"> {
    if (data.mode !== TIMER_NODE_MODES.SCHEDULED) return SCHEDULED_DEFAULTS;

    return {
        scheduledDateTime: data.scheduledDateTime ?? SCHEDULED_DEFAULTS.scheduledDateTime,
        repeat: data.repeat ?? SCHEDULED_DEFAULTS.repeat,
        timezone: data.timezone,
    };
}

/** The node's timer settings, each falling back to its default. */
export function timerSettings (data: TimerNodeData): TimerSettings {
    const {interval, immediate, runOnce} = intervalSettings(data);
    const {scheduledDateTime, repeat, timezone} = scheduledSettings(data);

    return {mode: data.mode, interval, immediate, runOnce, scheduledDateTime, repeat, timezone};
}

const isInterval = (settings: TimerSettings) => settings.mode === TIMER_NODE_MODES.INTERVAL;

/** An interval timer that runs once with no wait: it fires straight away, with no timer on the backend. */
export const firesOnceRightAway = (settings: TimerSettings): boolean => isInterval(settings) && settings.runOnce && settings.interval === 0;

/** A repeating interval timer that triggers once as it starts, then on every interval. */
export const triggersAsItStarts = (settings: TimerSettings): boolean => isInterval(settings) && !settings.runOnce && settings.immediate;

/** A timer that stops after its first trigger: a run-once interval, or a schedule that doesn't repeat. */
export const stopsAfterOneTrigger = (settings: TimerSettings): boolean => (isInterval(settings)
    ? settings.runOnce
    : settings.repeat === SCHEDULED_TIMER_REPEATS.ONCE);

/** What the backend timer gets: the current mode's settings. */
export const timerConfig = (settings: TimerSettings): TimerNodeData => (settings.mode === TIMER_NODE_MODES.INTERVAL
    ? {mode: settings.mode, interval: settings.interval, runOnce: settings.runOnce, immediate: settings.immediate}
    : {mode: settings.mode, scheduledDateTime: settings.scheduledDateTime, repeat: settings.repeat, timezone: settings.timezone});
