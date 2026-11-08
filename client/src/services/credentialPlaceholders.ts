/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useVaultStore} from "../stores/vault";
import {CUSTOM_CREDENTIAL_PREFIX} from "./credentials";


/** `{{NAME}}`, NAME spelled as a credential may be; spaces inside the braces are allowed. */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/** The credentials saved in Settings, as far as filling placeholders goes. */
export type SavedCredentials = {
    /** Their store keys, readable while the vault is locked; null with no vault. */
    keys: readonly string[] | null;
    /** Their values; null while the vault is locked. */
    values: Readonly<Record<string, string>> | null;
};

export type FilledText = {
    text: string;
    /** Puts the placeholders back wherever a filled value shows up in `message` (an error, a log line). */
    hide: (message: string) => string;
};

export function currentSavedCredentials (): SavedCredentials {
    const {file, secrets} = useVaultStore.getState();

    return {keys: file?.credentialKeys ?? null, values: secrets?.credentials ?? null};
}

// A declared credential is saved under its own name, a custom one under `credential.<name>`.
const storeKeyOf = (name: string, keys: readonly string[]): string | undefined =>
    [name, `${CUSTOM_CREDENTIAL_PREFIX}${name}`].find(key => keys.includes(key));

/**
 * The ways a value may show up in a message: as saved, percent-encoded, and as a URL parser writes it in a path or a
 * query. Chrome and fetch report URLs that way, encoding fewer characters than `encodeURI` and leaving "%" alone.
 */
function shownForms (value: string): string[] {
    const forms = [
        () => value,
        () => encodeURIComponent(value),
        () => encodeURI(value),
        () => new URL(`http://host/${value}`).pathname.slice(1),
        () => new URL(`http://host/?${value}`).search.slice(1),
    ].flatMap((form) => {
        try {
            return [form()];
        } catch {
            return [];
        }
    });

    // A parser may also cut a value short (at "#" or "?") or tidy it ("a/../b"): those shorter forms aren't the value.
    return [...new Set(forms.filter(form => form.length >= value.length))];
}

/**
 * Fills each `{{NAME}}` in `text` with the credential saved in Settings under that name, as it is saved. Throws, naming
 * the credential, when one isn't saved or the vault is locked.
 */
export function fillCredentialPlaceholders (text: string, saved: SavedCredentials = currentSavedCredentials()): FilledText {
    const names = [...new Set([...text.matchAll(PLACEHOLDER)].map(match => match[1]))];

    if (names.length === 0) return {text, hide: message => message};

    const values = new Map<string, string>();

    for (const name of names) {
        const storeKey = storeKeyOf(name, saved.keys ?? []);

        if (storeKey === undefined) throw new Error(`No saved credential named "${name}": add it in Settings → Credentials.`);

        if (saved.values === null) throw new Error(`The vault is locked: unlock it in Settings → Vault to use {{${name}}}.`);

        values.set(name, saved.values[storeKey] ?? "");
    }

    // Longest first, so a value that contains another is put back whole.
    const shown = [...values]
        .filter(([, value]) => value !== "")
        .flatMap(([name, value]) => shownForms(value).map(form => [form, `{{${name}}}`] as const))
        .sort(([a], [b]) => b.length - a.length);

    return {
        text: text.replace(PLACEHOLDER, (_match, name: string) => values.get(name) ?? ""),
        hide: message => shown.reduce((hidden, [form, placeholder]) => hidden.split(form).join(placeholder), message),
    };
}

/**
 * Runs `task` with the credentials filled into `text`. An error it throws comes back with their values replaced by
 * their placeholders, so a message that repeats the text (a URL, say) never shows a secret.
 */
export async function withCredentials<T> (
    text: string,
    task: (filled: string) => Promise<T>,
    saved: SavedCredentials = currentSavedCredentials(),
): Promise<T> {
    const {text: filled, hide} = fillCredentialPlaceholders(text, saved);

    try {
        return await task(filled);
    } catch (error) {
        // Not an Error: it carries no message that could hold a value.
        if (!(error instanceof Error)) throw error;

        throw new Error(hide(error.message));
    }
}
