/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {reconnectDelayMs, subscriptionError} from './graphQLSocketManager';


describe('reconnectDelayMs', () => {
    it('waits 1, 2, 4 seconds, then never more than 5, however long the backend stays away', () => {
        expect([0, 1, 2, 3, 10, 100].map(retries => reconnectDelayMs(retries, 0))).toEqual([1000, 2000, 4000, 5000, 5000, 5000]);
    });

    it('adds up to half a second at random', () => {
        expect(reconnectDelayMs(0, 0.999)).toBe(1499);
        expect(reconnectDelayMs(100, 0.5)).toBe(5250);
    });
});


describe('subscriptionError', () => {
    it('turns the server\'s list of errors into one Error with their messages', () => {
        const error = subscriptionError([{message: 'Timer t1 not found. Start the timer before subscribing.'}, {message: 'second'}]);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Timer t1 not found. Start the timer before subscribing.; second');
    });

    it('leaves anything else as it is', () => {
        const closed = new Error('socket closed');

        expect(subscriptionError(closed)).toBe(closed);
        expect(subscriptionError('text')).toBe('text');
    });
});
