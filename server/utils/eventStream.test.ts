/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {eventStream} from "./eventStream.ts";

function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

/** A source the test fires by hand, recording whether it was unsubscribed. */
function manualSource () {
    let emit: ((event: number) => void) | null = null;
    const state = {unsubscribed: 0};

    return {
        state,
        source: (onEvent: (event: number) => void) => {
            emit = onEvent;

            return () => {
                state.unsubscribed++;
            };
        },
        emit: (event: number) => emit!(event),
    };
}

Deno.test("eventStream: hands out every event once, in order, those arriving while it waits too", async () => {
    const {source, emit} = manualSource();
    const stream = eventStream(source);
    const first = stream.next();

    emit(1);
    emit(2);
    emit(3);

    assertEquals(await first, {value: 1, done: false});
    assertEquals(await stream.next(), {value: 2, done: false});
    assertEquals(await stream.next(), {value: 3, done: false});

    const later = stream.next();

    setTimeout(() => emit(4), 5);
    assertEquals(await later, {value: 4, done: false});
});

Deno.test("eventStream: next called twice without waiting gets the next two events, in order; ending finishes both", async () => {
    const {source, emit} = manualSource();
    const stream = eventStream(source);
    const [first, second] = [stream.next(), stream.next()];

    emit(1);
    emit(2);
    assertEquals([await first, await second], [{value: 1, done: false}, {value: 2, done: false}]);

    const [third, fourth] = [stream.next(), stream.next()];

    await stream.return!();
    assertEquals([await third, await fourth], [{value: undefined, done: true}, {value: undefined, done: true}]);
});

Deno.test("eventStream: ending it unsubscribes at once, finishes a waiting next, and drops what comes after", async () => {
    const {source, emit, state} = manualSource();
    const stream = eventStream(source);
    const waiting = stream.next();

    assertEquals(await stream.return!(), {value: undefined, done: true});
    assertEquals(await waiting, {value: undefined, done: true});
    assertEquals(state.unsubscribed, 1);

    emit(5);
    assertEquals(await stream.next(), {value: undefined, done: true});
    await stream.return!();
    assertEquals(state.unsubscribed, 1);
});

Deno.test("eventStream: a for-await loop that stops early unsubscribes", async () => {
    const {source, emit, state} = manualSource();
    const seen: number[] = [];
    const stream = eventStream(source);

    emit(0);
    setTimeout(() => emit(1), 5);

    for await (const event of stream) {
        seen.push(event);

        if (event === 1) break;
    }

    assertEquals([seen, state.unsubscribed], [[0, 1], 1]);
});

Deno.test("eventStream: throw ends it too, rejecting with the error", async () => {
    const {source, state} = manualSource();
    let rejected = "";

    await eventStream(source).throw!(new Error("stop")).catch((error: Error) => {
        rejected = error.message;
    });

    assertEquals([rejected, state.unsubscribed], ["stop", 1]);
});
