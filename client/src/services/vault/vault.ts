/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isRecord} from "../../utils/utils";
import {deriveVaultKey, randomBytes, VaultKey} from "./crypto";


/** The vault's own localStorage entry, apart from the global store's keys (those load in plain text at start). */
export const VAULT_STORAGE_KEY = "agentic-signal.vault";

/** PBKDF2 rounds for a new vault: OWASP's figure for PBKDF2-SHA256. */
export const VAULT_ITERATIONS = 600_000;

/** A short password falls quickly to guessing, however many rounds the key takes. */
export const MIN_PASSWORD_LENGTH = 8;

/** What the vault holds, decrypted. */
export type VaultSecrets = {
    /** Settings → Credentials: global store key → value. */
    credentials: Record<string, string>;
    /** Outside connections: connection id → token. */
    connectionTokens: Record<string, string>;
};

/** The stored vault. Nothing in it is, or reveals, the password. */
export type VaultFile = {
    version: 1;
    salt: string;
    iterations: number;
    iv: string;
    ciphertext: string;
    /** The saved credentials' store keys, readable while locked so Settings can list them. Never their values. */
    credentialKeys: string[];
};

export const EMPTY_SECRETS: VaultSecrets = {credentials: {}, connectionTokens: {}};

const SALT_BYTES = 16;

const toBase64 = (bytes: Uint8Array): string => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));

const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), char => char.charCodeAt(0));

const isStringRecord = (value: unknown): value is Record<string, string> => isRecord(value) && Object.values(value).every(item => typeof item === "string");

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");

/** A vault file's fields, each of its type; the version is checked apart. */
function hasVaultFields (parsed: Record<string, unknown>): parsed is Record<string, unknown> & Omit<VaultFile, "version"> {
    const strings = [parsed.salt, parsed.iv, parsed.ciphertext].every(value => typeof value === "string");

    return strings && typeof parsed.iterations === "number" && isStringArray(parsed.credentialKeys);
}

/** The stored vault, or null when there is none or it isn't one. */
export function parseVaultFile (raw: string | null | undefined): VaultFile | null {
    try {
        const parsed: unknown = JSON.parse(raw ?? "null");

        if (!isRecord(parsed) || parsed.version !== 1 || !hasVaultFields(parsed)) return null;

        const {salt, iterations, iv, ciphertext, credentialKeys} = parsed;

        return {version: 1, salt, iterations, iv, ciphertext, credentialKeys};
    } catch {
        return null;
    }
}

function parseSecrets (json: string): VaultSecrets {
    const parsed: unknown = JSON.parse(json);

    if (!isRecord(parsed) || !isStringRecord(parsed.credentials) || !isStringRecord(parsed.connectionTokens)) {
        throw new Error("The vault's contents aren't readable.");
    }

    return {credentials: parsed.credentials, connectionTokens: parsed.connectionTokens};
}

async function seal (key: VaultKey, salt: string, iterations: number, secrets: VaultSecrets): Promise<VaultFile> {
    const {iv, data} = await key.encrypt(new TextEncoder().encode(JSON.stringify(secrets)));

    return {version: 1, salt, iterations, iv: toBase64(iv), ciphertext: toBase64(data), credentialKeys: Object.keys(secrets.credentials).sort()};
}

/** A new vault for a password, with a fresh salt; and its key, to keep for the session. */
export async function createVault (
    password: string,
    secrets: VaultSecrets,
    {iterations = VAULT_ITERATIONS, useWebCrypto}: {iterations?: number; useWebCrypto?: boolean} = {}
): Promise<{file: VaultFile; key: VaultKey}> {
    const salt = toBase64(randomBytes(SALT_BYTES));
    const key = await deriveVaultKey(password, fromBase64(salt), iterations, useWebCrypto);

    return {file: await seal(key, salt, iterations, secrets), key};
}

/** Opens a vault: its key and its secrets. Throws WrongPasswordError for a wrong password. */
export async function openVault (file: VaultFile, password: string, {useWebCrypto}: {useWebCrypto?: boolean} = {}): Promise<{key: VaultKey; secrets: VaultSecrets}> {
    const key = await deriveVaultKey(password, fromBase64(file.salt), file.iterations, useWebCrypto);
    const plain = await key.decrypt(fromBase64(file.iv), fromBase64(file.ciphertext));

    return {key, secrets: parseSecrets(new TextDecoder().decode(plain))};
}

/** The vault with new contents under the same password and salt; a new iv every time. */
export function resealVault (file: VaultFile, key: VaultKey, secrets: VaultSecrets): Promise<VaultFile> {
    return seal(key, file.salt, file.iterations, secrets);
}
