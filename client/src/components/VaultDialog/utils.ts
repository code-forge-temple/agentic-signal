/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {MIN_PASSWORD_LENGTH} from "../../services/vault/vault";
import {WrongPasswordError} from "../../services/vault/crypto";
import {VaultPrompt, VaultPurpose} from "../../stores/vault";
import {errorMessage} from "@shared/utils";


export const TITLES: Record<VaultPrompt, string> = {
    create: "Create a Vault Password",
    unlock: "Unlock the Vault",
};

// The first sentence says why the popup appeared, when a save opened it.
const CREATE_REASONS: Record<VaultPurpose, string> = {
    credential: "Before the credential is saved, you need to create a vault password. ",
    connection: "Before the outside connection is saved, you need to create a vault password. ",
};

const INTROS: Record<VaultPrompt, string> = {
    create: "Saved credentials and outside connections' tokens are encrypted with this password. It's never stored and can't be recovered: "
        + "if you forget it, the vault has to be reset and its contents entered again.",
    unlock: "Your saved credentials and outside connections' tokens are encrypted. Enter your vault password to use them until the app reloads.",
};

/** What the popup says under its title: why it opened, when a save opened it, then what the password does. */
export function vaultIntro (prompt: VaultPrompt | null, purpose: VaultPurpose | null): string {
    const reason = prompt === "create" && purpose ? CREATE_REASONS[purpose] : "";

    return reason + (prompt ? INTROS[prompt] : "");
}

/** What's wrong with a new password (too short, or not repeated the same); null when it's fine, or when unlocking. */
export function passwordProblem (creating: boolean, password: string, confirm: string): string | null {
    if (!creating) return null;

    if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;

    return password === confirm ? null : "The two passwords don't match.";
}

/** Why the vault couldn't be made or opened. */
export const vaultOpenError = (error: unknown): string =>
    (error instanceof WrongPasswordError ? "Wrong password." : `Couldn't open the vault: ${errorMessage(error)}`);
