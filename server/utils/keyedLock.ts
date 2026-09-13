/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/**
 * Serialises async read-modify-write cycles that share a key.
 *
 * Needed where state is stored as one serialised blob holding many independent values: a caller
 * must read the whole blob, change one field and write the whole blob back, so two callers that
 * both read before either writes will each write a snapshot missing the other's change. The read
 * has to happen INSIDE the critical section — serialising only the writes leaves the stale read,
 * which is the actual problem.
 *
 * Keyed rather than global so unrelated blobs never wait on each other.
 */

const queues = new Map<string, Promise<unknown>>();

export function withKeyedLock<T> (key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    // `previous` is always a tail that cannot reject, so the chain never breaks.
    const result = previous.then(task);
    /*
     * The next waiter chains off a copy with the failure swallowed: one failed task must not
     * reject every task queued behind it. The caller still receives the real rejection through
     * `result`.
     */
    const tail = result.then(() => undefined, () => undefined);

    queues.set(key, tail);

    // Drop the entry once this is the last waiter, so the map doesn't retain a chain per key
    // for the life of the process.
    tail.then(() => {
        if (queues.get(key) === tail) {
            queues.delete(key);
        }
    });

    return result;
}

/** Test seam: the number of keys with work queued or in flight. */
export function pendingKeyCount (): number {
    return queues.size;
}
