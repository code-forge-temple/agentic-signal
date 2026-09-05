/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {DatePosted, Seniority} from "./types.ts";

const FETCH_TIMEOUT_MS = 15_000;

const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** GET a URL and parse JSON, with a timeout, a browser UA, and readable errors. */
export async function fetchJson<T = unknown> (url: string, label: string): Promise<T> {
    let response: Response;

    try {
        response = await fetch(url, {
            headers: {"Accept": "application/json", "User-Agent": BROWSER_UA},
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        throw new Error(`${label} request failed: ${message}`);
    }

    if (!response.ok) {
        throw new Error(`${label} returned ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`${label} did not return JSON (got ${text.slice(0, 60).replace(/\s+/g, " ")}…)`);
    }
}

/** Run `fn` over `items` with at most `concurrency` in flight. */
export async function pool<T> (items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    const queue = [...items];

    const workers = Array.from({length: Math.max(1, concurrency)}, async () => {
        while (queue.length) {
            const next = queue.shift();

            if (next !== undefined) await fn(next);
        }
    });

    await Promise.all(workers);
}

/** Decode the common HTML entities (Greenhouse returns entity-encoded markup). */
export function unescapeHtml (s: string | undefined | null): string {
    if (!s) return "";

    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

/** Strip tags/entities from an HTML snippet to a trimmed plain-text string. */
export function stripHtml (html: string | undefined | null): string {
    if (!html) return "";

    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
        .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
        .replace(/&hellip;/g, "...")
        .replace(/\s+/g, " ")
        .trim();
}

/** Epoch-ms cutoff for a `datePosted` window, or null for "any". */
export function datePostedCutoff (datePosted: DatePosted, now = Date.now()): number | null {
    const day = 24 * 60 * 60 * 1000;

    switch (datePosted) {
        case "today": return now - day;
        case "3days": return now - 3 * day;
        case "week": return now - 7 * day;
        case "month": return now - 30 * day;
        default: return null;
    }
}

/** True when `postedAt` is missing (can't tell — keep it) or newer than `cutoff`. */
export function withinDateWindow (postedAt: string | undefined, cutoff: number | null): boolean {
    if (cutoff === null || !postedAt) return true;

    const t = Date.parse(postedAt);

    return Number.isNaN(t) ? true : t >= cutoff;
}

/** Split a free-text location ("Remote - US, Canada" / "London or Berlin") into tokens. */
export function parseRegionList (value: string | undefined | null): string[] {
    if (!value) return [];

    return value
        .split(/,|;|\/|\||\band\b|\bor\b|&|–|—|-\s/i)
        .map(s => s.replace(/^\s*remote\s*[:-]?\s*/i, "").trim())
        .filter(s => s.length > 1 && !/^remote$/i.test(s));
}

const EUROPE_MEMBERS = new Set([
    "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "czech republic",
    "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "ireland",
    "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "poland",
    "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
    "norway", "iceland", "liechtenstein", "switzerland", "united kingdom", "uk",
]);

const WORLDWIDE_TOKENS = new Set([
    "worldwide", "world wide", "anywhere", "global", "globally", "fully remote", "international",
]);

const EUROPE_TOKENS = new Set([
    "europe", "european union", "eu", "eea", "emea", "europe/uk", "eu/uk",
]);

// Location words too vague to treat a non-match as a confident "no".
const VAGUE_LOCATION = new Set([
    "hybrid", "flexible", "on-site", "on site", "onsite", "in office", "in-office",
    "multiple locations", "various", "various locations", "office", "hq", "headquarters",
]);

/**
 * Best-effort: can a job whose candidate locations are `candidateLocations` hire
 * someone based in `target`? `high` confidence only on an unambiguous signal; the
 * ATS APIs expose only free-text location, so most calls come back `low`.
 */
export function evaluateEligibility (
    candidateLocations: string[],
    target: string
): { eligible: boolean | null; confidence: "high" | "low" } {
    const t = target.trim().toLowerCase();

    if (!t) return {eligible: null, confidence: "low"};

    if (candidateLocations.length === 0) return {eligible: null, confidence: "low"};

    const tokens = candidateLocations.map(s => s.trim().toLowerCase()).filter(Boolean);

    if (tokens.some(tok => WORLDWIDE_TOKENS.has(tok))) return {eligible: true, confidence: "high"};

    const targetIsEurope = EUROPE_TOKENS.has(t) || EUROPE_MEMBERS.has(t);

    if (tokens.some(tok => tok === t || tok.includes(t) || t.includes(tok))) {
        return {eligible: true, confidence: "high"};
    }

    if (targetIsEurope && tokens.some(tok => EUROPE_TOKENS.has(tok))) {
        return {eligible: true, confidence: "high"};
    }

    // Every token is a concrete, non-vague place and none matched the target —
    // treat as a confident "no" (e.g. a "Software Engineer - Germany" role for a
    // Cyprus-based candidate). Vague words ("Hybrid", "Flexible") stay low.
    const allConcrete = tokens.every(tok =>
        tok.length > 2 && !WORLDWIDE_TOKENS.has(tok) && !VAGUE_LOCATION.has(tok));

    return {eligible: false, confidence: allConcrete ? "high" : "low"};
}

/** Lowercase, flatten `-` `/` `.` and punctuation to spaces, split to words. */
function toMatchWords (s: string): string[] {
    return s.toLowerCase().replace(/[-_/.,()|]+/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * Relevance check against the job title + department/tags only (not the full
 * description — matching there floods results with roles that merely mention the
 * keyword). `keywords` is a comma-separated list of phrases. A job matches when,
 * for ANY phrase, EVERY word of that phrase appears (case-insensitively, as a
 * substring, in any order) in the title/department. So "full stack engineer"
 * matches "Senior Full-Stack Software Engineer" but not "Backend Engineer";
 * shorter phrases match more broadly. Blank = match everything.
 */
export function matchesKeywords (keywords: string, title: string, tags: string[]): boolean {
    const phrases = keywords.split(",").map(p => p.trim()).filter(Boolean);

    if (phrases.length === 0) return true;

    const haystack = toMatchWords(`${title} ${tags.join(" ")}`).join(" ");

    return phrases.some(phrase => {
        const words = toMatchWords(phrase);

        return words.length > 0 && words.every(word => haystack.includes(word));
    });
}

const SENIORITY_PATTERNS: Record<Exclude<Seniority, "any">, RegExp> = {
    junior: /\b(junior|jr\.?|entry[- ]?level|graduate|intern|trainee|associate)\b/i,
    mid: /\b(mid[- ]?level|intermediate|mid[- ]?weight)\b/i,
    senior: /\b(senior|sr\.?|staff|principal)\b/i,
    lead: /\b(lead|principal|head of|manager|director|vp|chief)\b/i,
};

/**
 * Best-effort seniority match against a level field plus the job title. Loose by
 * design: returns true whenever the wanted level isn't clearly contradicted.
 */
export function matchesSeniority (wanted: Seniority, levelField: string | undefined, title: string): boolean {
    if (wanted === "any") return true;

    const haystack = `${levelField ?? ""} ${title ?? ""}`;

    if (SENIORITY_PATTERNS[wanted].test(haystack)) return true;

    const anySignal = Object.values(SENIORITY_PATTERNS).some(re => re.test(haystack));

    return !anySignal;
}

/** Clamp a possibly-garbage number into [min, max], falling back to `fallback`. */
export function clampInt (value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(n)) return fallback;

    return Math.min(max, Math.max(min, Math.round(n)));
}
