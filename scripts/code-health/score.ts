/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Finding} from "./analyze";


export type Penalty = {fn: string | null; reason: string; points: number};

export type Score = {score: number; penalties: Penalty[]};

/** 9.5 and up is the level the AI-friendly-code talk (Adam Tornhill, GOTO 2026) sets for code an AI changes. */
export const BANDS = [
    {min: 9.5, name: "healthy"},
    {min: 8, name: "needs care"},
    {min: 4, name: "problematic"},
    {min: 1, name: "unhealthy"},
] as const;

export type Band = typeof BANDS[number]["name"];

const MAX_SCORE = 10;
const MIN_SCORE = 1;

// A base penalty for breaking the limit, growing with the excess, up to a cap.
const scaled = (finding: Finding, base: number, step: number, cap: number) => Math.min(cap, base + step * (finding.value - finding.limit));

type Rated = {points: number; reason: string};

// Nesting is rated per function below, not per deep block.
const RATINGS: Record<string, (finding: Finding) => Rated> = {
    "complexity": f => ({points: scaled(f, 0.5, 0.05, 2), reason: `complexity ${f.value} (limit ${f.limit})`}),
    "sonarjs/cognitive-complexity": f => ({points: scaled(f, 0.5, 0.05, 2), reason: `cognitive complexity ${f.value} (limit ${f.limit})`}),
    "max-lines-per-function": f => ({points: scaled(f, 0.5, 0.01, 1.5), reason: `${f.value} lines (limit ${f.limit})`}),
    "max-params": f => ({points: 0.25 * (f.value - f.limit), reason: `${f.value} parameters (limit ${f.limit})`}),
    "max-nested-callbacks": f => ({points: 0.5, reason: `callbacks nested ${f.value} deep (limit ${f.limit})`}),
    "sonarjs/expression-complexity": f => ({points: 0.25, reason: `a condition with ${f.value} operators (limit ${f.limit})`}),
    "sonarjs/no-identical-functions": () => ({points: 0.5, reason: "identical to another function"}),
    "sonarjs/no-duplicated-branches": () => ({points: 0.5, reason: "a duplicated branch"}),
    "max-lines": f => ({points: f.value > 2 * f.limit ? 1 : 0.5, reason: `file of ${f.value} lines (limit ${f.limit})`}),
};

const DEPTH = "max-depth";

const nestingPenalties = (findings: Finding[]): Penalty[] => {
    const deepest = new Map<string | null, Finding>();

    for (const finding of findings.filter(f => f.rule === DEPTH)) {
        const known = deepest.get(finding.fn);

        if (!known || finding.value > known.value) deepest.set(finding.fn, finding);
    }

    return [...deepest.values()].map(f => ({fn: f.fn, reason: `nested ${f.value} deep (limit ${f.limit})`, points: 1}));
};

// A "brain method": complex, long and deeply nested (or hard to follow) all at once.
const brainMethodPenalties = (findings: Finding[]): Penalty[] => {
    const rulesByFn = new Map<string, Set<string>>();

    for (const {fn, rule} of findings) {
        if (fn !== null) rulesByFn.set(fn, (rulesByFn.get(fn) ?? new Set()).add(rule));
    }

    return [...rulesByFn]
        .filter(([, rules]) => rules.has("complexity") && rules.has("max-lines-per-function") && (rules.has(DEPTH) || rules.has("sonarjs/cognitive-complexity")))
        .map(([fn]) => ({fn, reason: "brain method: complex, long and deeply nested", points: 1}));
};

/** A file's score from its findings: 10 less every penalty, never below 1. */
export function scoreFindings (findings: Finding[]): Score {
    const rated = findings
        .filter(finding => finding.rule in RATINGS)
        .map(finding => ({fn: finding.fn, ...RATINGS[finding.rule](finding)}));
    const penalties = [...rated, ...nestingPenalties(findings), ...brainMethodPenalties(findings)];
    const total = penalties.reduce((sum, penalty) => sum + penalty.points, 0);

    return {score: Math.max(MIN_SCORE, Math.round((MAX_SCORE - total) * 100) / 100), penalties};
}

export const bandOf = (score: number): Band => (BANDS.find(band => score >= band.min) ?? BANDS[BANDS.length - 1]).name;

const findingKey = (finding: Finding) => `${finding.rule}\u0000${finding.fn ?? ""}`;

/** The findings `after` has that `before` hadn't, by rule and function: a new problem, not a worse one. */
export function newFindings (before: Finding[], after: Finding[]): Finding[] {
    const remaining = new Map<string, number>();

    for (const finding of before) remaining.set(findingKey(finding), (remaining.get(findingKey(finding)) ?? 0) + 1);

    return after.filter((finding) => {
        const left = remaining.get(findingKey(finding)) ?? 0;

        remaining.set(findingKey(finding), left - 1);

        return left <= 0;
    });
}
