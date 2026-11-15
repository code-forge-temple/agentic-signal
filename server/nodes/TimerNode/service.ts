/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimerConfig, TimerTriggerEvent, ScheduledTimerConfig, TIMER_NODE_MODES, SCHEDULED_TIMER_REPEATS} from "./types.ts";


// Deno, like browsers, fires a setTimeout longer than 2^31 - 1 ms (about 24.8 days) almost at once.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** `days` days after `date`, at the same time of day here, across a daylight-saving change too. */
function daysAfter (date: Date, days: number): Date {
    const later = new Date(date);

    later.setDate(later.getDate() + days);

    return later;
}

/** `months` months after `date`, on its day and time; on that month's last day when it's shorter (31 January → 28 February). */
function monthsAfter (date: Date, months: number): Date {
    const later = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    const lastDay = new Date(later.getFullYear(), later.getMonth() + 1, 0).getDate();

    later.setDate(Math.min(date.getDate(), lastDay));

    return later;
}

// A repeating scheduled timer's nth repeat, counted from its first time: a monthly one set for the 31st is back on the
// 31st after a shorter month. A Map, not an object: the repeat comes from the client unchecked, and an object would
// answer "constructor" or "toString" with a function of its prototype.
const REPEATS = new Map<string, (first: Date, n: number) => Date>([
    [SCHEDULED_TIMER_REPEATS.DAILY, (first, n) => daysAfter(first, n)],
    [SCHEDULED_TIMER_REPEATS.WEEKLY, (first, n) => daysAfter(first, 7 * n)],
    [SCHEDULED_TIMER_REPEATS.MONTHLY, monthsAfter],
]);

/**
 * When a scheduled timer fires next: at its time when that's still ahead; once it has passed, at the first repeat after
 * `now` (null for one that doesn't repeat).
 */
export function nextScheduledTrigger (scheduled: Date, repeat: SCHEDULED_TIMER_REPEATS, now: Date): Date | null {
    if (!(scheduled <= now)) return scheduled;

    const nthRepeat = REPEATS.get(repeat);

    if (!nthRepeat) return null;

    let n = 1;
    let next = nthRepeat(scheduled, n);

    while (next <= now) next = nthRepeat(scheduled, ++n);

    return next;
}

type TimerInstance = {
    id: string;
    config: TimerConfig;
    // Not `number`: newer Deno types setTimeout with Node's Timeout.
    timer: ReturnType<typeof setTimeout> | null;
    subscribers: Set<(event: TimerTriggerEvent) => void>;
    startTime?: number; // For drift correction
    expectedTime?: number; // For drift correction
};

class TimerService {
    private timers: Map<string, TimerInstance> = new Map();

    startTimer (nodeId: string, config: TimerConfig): void {
        if (config.mode === TIMER_NODE_MODES.INTERVAL && !config.runOnce && !(config.interval > 0)) {
            // It would fire in a tight loop, every trigger running the workflow again.
            throw new Error(`A repeating interval timer needs an interval above 0 seconds (it was ${config.interval}).`);
        }

        // A restarted timer keeps who listens to it: a client subscribed to the timer before (a Delayed Snapshot given new
        // input while it waits) hears the new one, and unsubscribing still works on the same set.
        const subscribers = this.timers.get(nodeId)?.subscribers ?? new Set();

        this.stopTimer(nodeId);

        const instance: TimerInstance = {
            id: nodeId,
            config,
            timer: null,
            subscribers,
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
            const intervalMs = config.interval * 1000;

            // Triggers missed while the process was held up (a laptop asleep, a late fire) are skipped, not fired in a
            // burst: the next one is the first slot after now.
            if (intervalMs > 0 && instance.expectedTime! <= now) {
                instance.expectedTime! += (Math.floor((now - instance.expectedTime!) / intervalMs) + 1) * intervalMs;
            }

            // Until the trigger due next (a late one makes the next wait shorter, so they don't drift); a clock set back
            // waits one interval, not as long as it went back.
            const nextDelay = Math.min(intervalMs, Math.max(0, instance.expectedTime! - now));

            this.waitThen(instance, nextDelay, () => {
                trigger();
                instance.expectedTime! += config.interval * 1000;

                if (!config.runOnce) {
                    scheduleNext();
                }
            });
        };

        scheduleNext();
    }

    private startScheduledTimer (instance: TimerInstance): void {
        if (instance.config.mode !== TIMER_NODE_MODES.SCHEDULED) return;

        // The trigger last fired: a wake-up a moment early by the clock can't fire it again.
        let lastTrigger = -Infinity;

        const scheduleNextTrigger = () => {
            if (!this.timers.has(instance.id)) return;

            const config = instance.config as ScheduledTimerConfig;
            const now = Date.now();
            const nextTrigger = nextScheduledTrigger(new Date(config.scheduledDateTime), config.repeat, new Date(Math.max(now, lastTrigger)));
            const delay = nextTrigger ? nextTrigger.getTime() - now : 0;

            if (nextTrigger && delay > 0) {
                this.waitThen(instance, delay, () => {
                    lastTrigger = nextTrigger.getTime();
                    this.notifySubscribers(instance.id, {
                        nodeId: instance.id,
                        timestamp: Date.now(),
                        type: TIMER_NODE_MODES.SCHEDULED
                    });

                    if (config.repeat !== SCHEDULED_TIMER_REPEATS.ONCE) {
                        scheduleNextTrigger();
                    }
                });
            }
        };

        scheduleNextTrigger();
    }

    /**
     * Runs `fire` after `delay` ms, waiting in steps of at most MAX_TIMEOUT_MS (a monthly timer's month is longer). The
     * instance's timer is always the step waiting now, so stopping the timer cancels the rest.
     */
    private waitThen (instance: TimerInstance, delay: number, fire: () => void): void {
        if (delay <= MAX_TIMEOUT_MS) {
            instance.timer = setTimeout(fire, delay);

            return;
        }

        const until = Date.now() + delay;

        instance.timer = setTimeout(() => this.waitThen(instance, until - Date.now(), fire), MAX_TIMEOUT_MS);
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