/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {firesOnceRightAway, stopsAfterOneTrigger, timerConfig, timerSettings, triggersAsItStarts} from './timerSettings';
import {defaultTimerNodeData, SCHEDULED_TIMER_REPEATS, TIMER_NODE_MODES, TimerNodeData} from '../types/workflow';


const interval = (settings: Partial<{interval: number; immediate: boolean; runOnce: boolean}>) =>
    timerSettings({mode: TIMER_NODE_MODES.INTERVAL, interval: 30, immediate: false, runOnce: false, ...settings});
const scheduled = (repeat: string) =>
    timerSettings({mode: TIMER_NODE_MODES.SCHEDULED, scheduledDateTime: '2026-12-01T09:00:00.000Z', repeat, timezone: 'Europe/Bucharest'} as TimerNodeData);

describe('timerSettings', () => {
    it('takes the current mode\'s settings, and the other mode\'s defaults', () => {
        const {scheduledDateTime, repeat} = defaultTimerNodeData[TIMER_NODE_MODES.SCHEDULED];

        expect(interval({interval: 5})).toEqual({mode: 'interval', interval: 5, immediate: false, runOnce: false, scheduledDateTime, repeat, timezone: undefined});
        expect(scheduled(SCHEDULED_TIMER_REPEATS.DAILY)).toMatchObject({mode: 'scheduled', repeat: 'daily', timezone: 'Europe/Bucharest', interval: 60, runOnce: true});
    });
});

describe('timer rules', () => {
    it('fires once right away only for a run-once interval of 0', () => {
        expect(firesOnceRightAway(interval({runOnce: true, interval: 0}))).toBe(true);
        expect(firesOnceRightAway(interval({runOnce: true, interval: 10}))).toBe(false);
        expect(firesOnceRightAway(interval({runOnce: false, interval: 0}))).toBe(false);
        expect(firesOnceRightAway(scheduled(SCHEDULED_TIMER_REPEATS.ONCE))).toBe(false);
    });

    it('triggers as it starts only when repeating with "trigger immediately" on', () => {
        expect(triggersAsItStarts(interval({immediate: true}))).toBe(true);
        expect(triggersAsItStarts(interval({immediate: true, runOnce: true}))).toBe(false);
        expect(triggersAsItStarts(interval({immediate: false}))).toBe(false);
    });

    it('stops after one trigger for a run-once interval or a schedule that does not repeat', () => {
        expect(stopsAfterOneTrigger(interval({runOnce: true}))).toBe(true);
        expect(stopsAfterOneTrigger(interval({runOnce: false}))).toBe(false);
        expect(stopsAfterOneTrigger(scheduled(SCHEDULED_TIMER_REPEATS.ONCE))).toBe(true);
        expect(stopsAfterOneTrigger(scheduled(SCHEDULED_TIMER_REPEATS.WEEKLY))).toBe(false);
    });

    it('gives the backend only the current mode\'s settings', () => {
        expect(timerConfig(interval({interval: 5, immediate: true}))).toEqual({mode: 'interval', interval: 5, runOnce: false, immediate: true});
        expect(timerConfig(scheduled(SCHEDULED_TIMER_REPEATS.DAILY)))
            .toEqual({mode: 'scheduled', scheduledDateTime: '2026-12-01T09:00:00.000Z', repeat: 'daily', timezone: 'Europe/Bucharest'});
    });
});
