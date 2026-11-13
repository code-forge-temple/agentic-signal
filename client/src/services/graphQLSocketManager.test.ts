/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {subscriptionError} from './graphQLSocketManager';


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
