/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NormalizedJob} from "./types.ts";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 2000;

type Entry = { jobs: NormalizedJob[]; expires: number };

/**
 * Process-wide cache of a company's normalized jobs, keyed by `ats:token`. The
 * Deno backend is long-lived, so re-running the node while iterating on filters
 * doesn't re-hit the ATSs. Not persisted — a restart clears it.
 */
const store = new Map<string, Entry>();

export function getCachedJobs (key: string): NormalizedJob[] | undefined {
    const entry = store.get(key);

    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
        store.delete(key);

        return undefined;
    }

    return entry.jobs;
}

export function setCachedJobs (key: string, jobs: NormalizedJob[]): void {
    if (store.size >= MAX_ENTRIES) {
        const oldest = store.keys().next().value;

        if (oldest !== undefined) store.delete(oldest);
    }

    store.set(key, {jobs, expires: Date.now() + TTL_MS});
}
