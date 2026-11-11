/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {sha256} from "@noble/hashes/sha2.js";
import {isRecord} from "../utils";
import {normalizeCommand} from "../workflows";
import {hasWebCrypto} from "./vault/crypto";


/** An outside app allowed to call workflow commands with its token. */
export type CommandConnection = {
    id: string;
    name: string;
    /** The token's SHA-256, all the backend needs to accept a call: so calls work while the vault is locked. */
    tokenHash?: string;
    /** Only in a connection saved before there was a vault: the token itself, in plain text. Creating the vault moves it there. */
    token?: string;
    /** The commands it may call; empty means all. */
    commands: string[];
};

/** Kept in the global store (persisted, and gone with Clear App Data); the tokens themselves are in the vault. */
export const COMMAND_CONNECTIONS_KEY = "commandConnections";

const hasIdentity = (item: Record<string, unknown>) => typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.commands);

// The token's hash, or in a connection saved before there was a vault, the token itself.
const hasSecret = (item: Record<string, unknown>) => typeof item.tokenHash === "string" || typeof item.token === "string";

const isCommandConnection = (item: unknown): item is CommandConnection => isRecord(item) && hasIdentity(item) && hasSecret(item);

export function parseCommandConnections (raw: string | undefined): CommandConnection[] {
    try {
        const parsed: unknown = JSON.parse(raw ?? "[]");

        return Array.isArray(parsed) ? parsed.filter(isCommandConnection) : [];
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
    // Web Crypto is missing on a page opened over plain http from another computer: the same hash, computed in code.
    const digest = hasWebCrypto() ? new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)) : sha256(bytes);

    return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
