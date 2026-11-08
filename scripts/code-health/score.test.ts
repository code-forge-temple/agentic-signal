/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from "bun:test";
import type {Finding} from "./analyze";
import {bandOf, newFindings, scoreFindings} from "./score";


const finding = (rule: string, value: number, limit: number, fn: string | null = "run"): Finding => ({rule, line: 1, value, limit, fn});

describe("scoreFindings", () => {
    it("is 10 with nothing found", () => {
        expect(scoreFindings([]).score).toBe(10);
    });

    it("grows a penalty with the excess, up to its cap", () => {
        expect(scoreFindings([finding("complexity", 12, 10)]).score).toBe(9.4);
        expect(scoreFindings([finding("complexity", 90, 10)]).score).toBe(8);
    });

    it("rates nesting once per function, however many blocks are too deep", () => {
        const score = scoreFindings([finding("max-depth", 5, 4), finding("max-depth", 7, 4), finding("max-depth", 5, 4, "other")]);

        expect(score.score).toBe(8);
        expect(score.penalties.map(p => p.reason)).toContain("nested 7 deep (limit 4)");
    });

    it("adds a brain-method penalty to a function that is complex, long and deeply nested", () => {
        const findings = [finding("complexity", 20, 10), finding("max-lines-per-function", 120, 70), finding("max-depth", 6, 4)];

        expect(scoreFindings(findings).penalties.some(p => p.reason.startsWith("brain method"))).toBe(true);
    });

    it("never goes below 1", () => {
        expect(scoreFindings(Array.from({length: 20}, (_, i) => finding("complexity", 50, 10, `f${i}`))).score).toBe(1);
    });
});

describe("bandOf", () => {
    it("puts 9.5 and up in healthy", () => {
        expect([10, 9.5, 9.4, 8, 7.9, 4, 3.9].map(bandOf)).toEqual(["healthy", "healthy", "needs care", "needs care", "problematic", "problematic", "unhealthy"]);
    });
});

describe("newFindings", () => {
    it("reports a new problem, not a worse value of a known one", () => {
        const before = [finding("complexity", 12, 10)];
        const after = [finding("complexity", 15, 10), finding("max-params", 5, 4)];

        expect(newFindings(before, after).map(f => f.rule)).toEqual(["max-params"]);
    });

    it("counts a second finding of the same rule in the same function as new", () => {
        expect(newFindings([finding("max-depth", 5, 4)], [finding("max-depth", 5, 4), finding("max-depth", 6, 4)])).toHaveLength(1);
    });
});
