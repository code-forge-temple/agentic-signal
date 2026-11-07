/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isRecord} from "../utils";
import {sha256} from "../utils/sha256";
import {normalizeCommand} from "../workflows";


/** An outside app allowed to call workflow commands with its token. */
export type CommandConnection = {
    id: string;
    name: string;
    token: string;
    /** The commands it may call; empty means all. */
    commands: string[];
};

/** Kept in the global store with the API keys: persisted, and gone with Clear App Data. */
export const COMMAND_CONNECTIONS_KEY = "commandConnections";

export function parseCommandConnections (raw: string | undefined): CommandConnection[] {
    try {
        const parsed: unknown = JSON.parse(raw ?? "[]");

        return Array.isArray(parsed)
            ? parsed.filter((item): item is CommandConnection => isRecord(item)
                && typeof item.id === "string" && typeof item.name === "string" && typeof item.token === "string" && Array.isArray(item.commands))
            : [];
    } catch {
        return [];
    }
}

/** "research, Daily-Report" → ["research", "daily-report"]; names that aren't commands are dropped. */
export function parseCommandList (text: string): string[] {
    return [...new Set(text.split(/[\s,]+/).map(normalizeCommand).filter(Boolean))];
}

/** A fresh secret for a connection: 24 random bytes, readable as a token. */
export function newCommandToken (): string {
    const bytes = crypto.getRandomValues(new Uint8Array(24));

    return `as_${[...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** What the backend gets instead of the token itself. */
export async function sha256Hex (text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    // Missing on a page opened over plain http from another computer: the same hash, computed in code.
    const digest = typeof crypto.subtle === "undefined" ? sha256(bytes) : new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

    return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
