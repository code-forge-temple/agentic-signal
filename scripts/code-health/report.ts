/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Finding} from "./analyze";
import type {FileChange, FileHealth} from "./health";
import {BANDS, bandOf, type Penalty, scoreFindings} from "./score";


const one = (score: number) => score.toFixed(1);

/** "useAIProcessor: complexity 74 (limit 10), 260 lines (limit 70)", worst functions first. */
export function describePenalties (penalties: Penalty[], max = 3): string[] {
    const byFn = new Map<string, Penalty[]>();

    for (const penalty of penalties) {
        const key = penalty.fn ?? "(file)";

        byFn.set(key, [...(byFn.get(key) ?? []), penalty]);
    }

    const points = (list: Penalty[]) => list.reduce((sum, penalty) => sum + penalty.points, 0);

    return [...byFn]
        .sort(([, a], [, b]) => points(b) - points(a))
        .slice(0, max)
        .map(([fn, list]) => `${fn}: ${list.map(penalty => penalty.reason).join(", ")}`);
}

const weightedAverage = (files: FileHealth[]) => {
    const lines = files.reduce((sum, file) => sum + file.lines, 0);

    return lines === 0 ? 10 : files.reduce((sum, file) => sum + file.health.score * file.lines, 0) / lines;
};

const fileBlock = (score: string, file: string, penalties: Penalty[]) =>
    [`  ${score}  ${file}`, ...describePenalties(penalties).map(line => `         ${line}`)].join("\n");

/** The whole repo: the average, how many files fall in each band, and the worst files. */
export function repoReport (files: FileHealth[], top: number): string {
    const bands = BANDS.map(({name, min}) => `${name} (${min}+): ${files.filter(file => bandOf(file.health.score) === name).length}`);
    const worst = [...files].sort((a, b) => a.health.score - b.health.score).filter(file => file.health.score < 10).slice(0, top);

    return [
        `Code health: ${files.length} files, average ${one(weightedAverage(files))} (weighted by lines)`,
        `  ${bands.join("   ")}`,
        "",
        worst.length > 0 ? `The ${worst.length} lowest:` : "Every file scores 10.",
        ...worst.map(file => fileBlock(one(file.health.score), file.file, file.health.penalties)),
    ].join("\n");
}

const newProblems = (added: Finding[]) => describePenalties(scoreFindings(added).penalties, 10).map(line => `         new: ${line}`);

/** Changed files against the last commit: before → after, and the problems they gained. */
export function changeReport (changes: FileChange[]): string {
    if (changes.length === 0) return "No changed TypeScript files.";

    const rows = changes.map((change) => {
        const after = one(change.health.score);
        const score = change.before === null ? `new ${after}` : `${one(change.before.score)} → ${after}`;
        const mark = change.regression ? "  ✗ worse" : "";

        const current = describePenalties(change.health.penalties).map(line => `         ${line}`);

        return [`  ${score.padEnd(11)}${change.file}${mark}`, ...current, ...newProblems(change.added)].join("\n");
    });
    const worse = changes.filter(change => change.regression).length;

    return [`Code health of ${changes.length} files against the last commit, ${worse} worse:`, ...rows].join("\n");
}

/** Files that change often and score low: where a refactoring pays off first. */
export function hotspotReport (files: FileHealth[], counts: Map<string, number>, top: number): string {
    const hotspots = files
        .map(file => ({file, changes: counts.get(file.file) ?? 0, weight: (counts.get(file.file) ?? 0) * (10 - file.health.score)}))
        .filter(hotspot => hotspot.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, top);

    return [
        "Hotspots: changed often in the last 6 months, and low in code health",
        ...hotspots.map(({file, changes}) => fileBlock(`${one(file.health.score)}  ${String(changes).padStart(3)}×`, file.file, file.health.penalties)),
    ].join("\n");
}

/** What the hooks show Claude when a change made code health worse. */
export function regressionMessage (changes: FileChange[]): string {
    const files = changes.map((change) => {
        const before = change.before === null ? "new file" : `${one(change.before.score)} →`;

        return [`${change.file}: ${before} ${one(change.health.score)}`, ...newProblems(change.added)].join("\n");
    });

    return ["Code health got worse (see the code-health skill):", ...files].join("\n");
}
