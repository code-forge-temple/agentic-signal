/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {analyzeText, type Finding} from "./analyze";
import {headText, readText, ROOT} from "./files";
import {newFindings, scoreFindings, type Score} from "./score";


export type FileHealth = {file: string; lines: number; findings: Finding[]; health: Score};

/** A changed file: its health now and as committed (null when it's new), and what got worse. */
export type FileChange = FileHealth & {
    before: Score | null;
    /** Problems the committed version didn't have; in a new file, all of them. */
    added: Finding[];
    regression: boolean;
};

export async function fileHealth (file: string, text = readText(file)): Promise<FileHealth> {
    const {findings, lines} = await analyzeText(ROOT, file, text);

    return {file, lines, findings, health: scoreFindings(findings)};
}

export async function fileChange (file: string): Promise<FileChange> {
    const now = await fileHealth(file);
    const committed = headText(file);
    const then = committed === null ? null : await fileHealth(file, committed);
    const added = newFindings(then?.findings ?? [], now.findings);
    const dropped = then !== null && now.health.score < then.health.score - 0.001;

    return {...now, before: then?.health ?? null, added, regression: dropped || added.length > 0};
}

/** One file after another: ESLint does the work synchronously anyway. */
export async function inSequence<T> (files: string[], measure: (file: string) => Promise<T>): Promise<T[]> {
    const results: T[] = [];

    for (const file of files) results.push(await measure(file));

    return results;
}
