/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimerConfig, TimerTriggerEvent, ScheduledTimerConfig, TIMER_NODE_MODES, SCHEDULED_TIMER_REPEATS} from "./types.ts";


const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

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
            const scheduled = new Date(config.scheduledDateTime);
            let nextTrigger = scheduled;

            if (scheduled <= now) {
                switch (config.repeat) {
                    case SCHEDULED_TIMER_REPEATS.ONCE:

                        return;
                    case SCHEDULED_TIMER_REPEATS.DAILY:
                        while (nextTrigger <= now) {
                            nextTrigger = new Date(nextTrigger.getTime() + ONE_DAY_MS);
                        }

                        break;
                    case SCHEDULED_TIMER_REPEATS.WEEKLY:
                        while (nextTrigger <= now) {
                            nextTrigger = new Date(nextTrigger.getTime() + ONE_WEEK_MS);
                        }

                        break;
                    case SCHEDULED_TIMER_REPEATS.MONTHLY:
                        while (nextTrigger <= now) {
                            const year = nextTrigger.getFullYear();
                            const month = nextTrigger.getMonth();
                            const day = Math.min(
                                nextTrigger.getDate(),
                                new Date(year, month + 2, 0).getDate() // Last day of next month
                            );

                            nextTrigger = new Date(
                                year,
                                month + 1,
                                day,
                                nextTrigger.getHours(),
                                nextTrigger.getMinutes(),
                                nextTrigger.getSeconds()
                            );
                        }

                        break;
                }
            }

            const delay = nextTrigger.getTime() - now.getTime();

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