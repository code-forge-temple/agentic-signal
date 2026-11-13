/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/** Starts delivering events to the callback, and returns what stops it. */
export type EventSource<T> = (onEvent: (event: T) => void) => () => void;

/**
 * A source's events as an async iterator, for a GraphQL subscription's `subscribe`: each event is handed out once, in
 * order, also the ones arriving while nothing is waiting for the next. Ending the subscription (`return`) unsubscribes
 * at once, even while a `next` is still waiting.
 */
export function eventStream<T> (source: EventSource<T>): AsyncIterableIterator<T> {
    const queue: T[] = [];
    // The `next` calls still waiting, oldest first: each event goes to the oldest.
    const waiting: ((result: IteratorResult<T>) => void)[] = [];
    let ended = false;

    const unsubscribe = source((event) => {
        if (ended) return;

        const next = waiting.shift();

        if (next) {
            next({value: event, done: false});
        } else {
            queue.push(event);
        }
    });

    const end = (): Promise<IteratorResult<T>> => {
        if (!ended) {
            ended = true;
            unsubscribe();
        }

        queue.length = 0;

        for (const next of waiting.splice(0)) next({value: undefined, done: true});

        return Promise.resolve({value: undefined, done: true});
    };

    return {
        next: () => {
            if (queue.length > 0) return Promise.resolve({value: queue.shift()!, done: false});

            if (ended) return Promise.resolve({value: undefined, done: true});

            return new Promise((resolve) => {
                waiting.push(resolve);
            });
        },
        return: end,
        throw: (error: unknown) => end().then(() => Promise.reject(error)),
        [Symbol.asyncIterator] () {
            return this;
        },
    };
}
