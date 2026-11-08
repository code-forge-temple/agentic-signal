/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// Claude Code hooks (.claude/settings.json). Exit code 2 hands what's written to stderr back to Claude: after an edit,
// as feedback on that file; at the end of a turn, as a reason to keep going.
import {existsSync} from "node:fs";
import path from "node:path";
import {changedFiles, isScored, repoPath, ROOT} from "./files";
import {fileChange, inSequence} from "./health";
import {regressionMessage} from "./report";


type HookInput = {tool_input?: {file_path?: string}; stop_hook_active?: boolean};

const FEEDBACK = 2;

// Unreadable input checks nothing rather than getting in the way.
const readInput = async (): Promise<HookInput> => {
    try {
        return JSON.parse(await Bun.stdin.text()) as HookInput;
    } catch {
        return {};
    }
};

// After an Edit or Write: the edited file only.
async function afterEdit (input: HookInput): Promise<number> {
    const edited = input.tool_input?.file_path;
    const file = edited ? repoPath(edited) : null;

    if (!file || !isScored(file) || !existsSync(path.join(ROOT, file))) return 0;

    const change = await fileChange(file);

    if (!change.regression) return 0;

    console.error(regressionMessage([change]));

    return FEEDBACK;
}

// At the end of a turn: every changed file. Once only: when Claude is already continuing because of this hook
// (stop_hook_active), it may stop, so a regression it can't fix never loops.
async function onStop (input: HookInput): Promise<number> {
    if (input.stop_hook_active) return 0;

    const regressed = (await inSequence(changedFiles(), fileChange)).filter(change => change.regression);

    if (regressed.length === 0) return 0;

    console.error(`${regressionMessage(regressed)}\nRefactor before finishing, or tell the user why it can't be fixed now.`);

    return FEEDBACK;
}

export async function runHook (mode: string): Promise<number> {
    const input = await readInput();

    if (mode === "after-edit") return afterEdit(input);

    if (mode === "stop") return onStop(input);

    console.error(`Unknown hook "${mode}": use after-edit or stop.`);

    return 1;
}
