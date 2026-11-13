/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimerConfig, TimerTriggerEvent, ScheduledTimerConfig, TIMER_NODE_MODES, SCHEDULED_TIMER_REPEATS} from "./types.ts";


const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/** A month later, on the same day and time; on the next month's last day when it's shorter (31 January → 28 February). */
function aMonthLater (date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = Math.min(date.getDate(), new Date(year, month + 2, 0).getDate()); // Last day of next month

    return new Date(year, month + 1, day, date.getHours(), date.getMinutes(), date.getSeconds());
}

// The step from one trigger of a repeating scheduled timer to the next. A Map, not an object: the repeat comes from the
// client unchecked, and an object would answer "constructor" or "toString" with a function of its prototype.
const REPEAT_STEPS = new Map<string, (date: Date) => Date>([
    [SCHEDULED_TIMER_REPEATS.DAILY, date => new Date(date.getTime() + ONE_DAY_MS)],
    [SCHEDULED_TIMER_REPEATS.WEEKLY, date => new Date(date.getTime() + ONE_WEEK_MS)],
    [SCHEDULED_TIMER_REPEATS.MONTHLY, aMonthLater],
]);

/**
 * When a scheduled timer fires next: at its time when that's still ahead; once it has passed, at the first repeat after
 * `now` (null for one that doesn't repeat).
 */
export function nextScheduledTrigger (scheduled: Date, repeat: SCHEDULED_TIMER_REPEATS, now: Date): Date | null {
    if (!(scheduled <= now)) return scheduled;

    const step = REPEAT_STEPS.get(repeat);

    if (!step) return null;

    let next = scheduled;

    while (next <= now) next = step(next);

    return next;
}

type TimerInstance = {
    id: string;
    config: TimerConfig;
    timer: number | null;
    subscribers: Set<(event: TimerTriggerEvent) => void>;
    startTime?: number; // For drift correction
    expectedTime?: number; // For drift correction
};

class TimerService {
    private timers: Map<string, TimerInstance> = new Map();

    startTimer (nodeId: string, config: TimerConfig): void {
        this.stopTimer(nodeId);

        const instance: TimerInstance = {
            id: nodeId,
            config,
            timer: null,
            subscribers: new Set()
        };

        this.timers.set(nodeId, instance);

        if (config.mode === TIMER_NODE_MODES.INTERVAL) {
            this.startIntervalTimer(instance);
        } else if (config.mode === TIMER_NODE_MODES.SCHEDULED) {
            this.startScheduledTimer(instance);
        }
    }

    private startIntervalTimer (instance: TimerInstance): void {
        if (instance.config.mode !== TIMER_NODE_MODES.INTERVAL) return;

        const config = instance.config;
        const trigger = () => {
            this.notifySubscribers(instance.id, {
                nodeId: instance.id,
                timestamp: Date.now(),
                type: TIMER_NODE_MODES.INTERVAL
            });

            if (config.runOnce) {
                this.stopTimer(instance.id);
            }
        };

        instance.startTime = Date.now();
        instance.expectedTime = instance.startTime + (config.interval * 1000);

        const scheduleNext = () => {
            if (!this.timers.has(instance.id)) return;

            const now = Date.now();
            const drift = now - instance.expectedTime!;
            const nextDelay = Math.max(0, config.interval * 1000 - drift);

            instance.timer = setTimeout(() => {
                trigger();
                instance.expectedTime! += config.interval * 1000;

                if (!config.runOnce) {
                    scheduleNext();
                }
            }, nextDelay);
        };

        scheduleNext();
    }

    private startScheduledTimer (instance: TimerInstance): void {
        if (instance.config.mode !== TIMER_NODE_MODES.SCHEDULED) return;

        const scheduleNextTrigger = () => {
            if (!this.timers.has(instance.id)) return;

            const config = instance.config as ScheduledTimerConfig;
            const now = new Date();
            const nextTrigger = nextScheduledTrigger(new Date(config.scheduledDateTime), config.repeat, now);
            const delay = nextTrigger ? nextTrigger.getTime() - now.getTime() : 0;

            if (delay > 0) {
                instance.timer = setTimeout(() => {
                    this.notifySubscribers(instance.id, {
                        nodeId: instance.id,
                        timestamp: Date.now(),
                        type: TIMER_NODE_MODES.SCHEDULED
                    });

                    if (config.repeat !== SCHEDULED_TIMER_REPEATS.ONCE) {
                        scheduleNextTrigger();
                    }
                }, delay);
            }
        };

        scheduleNextTrigger();
    }

    stopTimer (nodeId: string): void {
        const instance = this.timers.get(nodeId);

        if (instance && 'timer' in instance && instance.timer !== null) {
            clearInterval(instance.timer);
            clearTimeout(instance.timer);
        }

        this.timers.delete(nodeId);
    }

    subscribe (nodeId: string, callback: (event: TimerTriggerEvent) => void): () => void {
        const instance = this.timers.get(nodeId);

        if (!instance) {
            throw new Error(`Timer ${nodeId} not found. Start the timer before subscribing.`);
        }

        instance.subscribers.add(callback);

        return () => {
            instance.subscribers.delete(callback);
        };
    }

    private notifySubscribers (nodeId: string, event: TimerTriggerEvent): void {
        const instance = this.timers.get(nodeId);

        if (!instance) return;

        instance.subscribers.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error(`[TimerService] Error in subscriber callback for ${nodeId}:`, error);
            }
        });
    }

    getActiveTimers (): string[] {
        return Array.from(this.timers.keys());
    }

    getTimerInfo (nodeId: string): { config: TimerConfig; subscriberCount: number } | null {
        const instance = this.timers.get(nodeId);

        if (!instance) return null;

        return {
            config: instance.config,
            subscriberCount: instance.subscribers.size
        };
    }
}

export const timerService = new TimerService();