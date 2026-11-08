/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {pbkdf2Async} from "@noble/hashes/pbkdf2.js";
import {sha256} from "@noble/hashes/sha2.js";
import {gcm} from "@noble/ciphers/aes.js";


/** A key made from the vault password: AES-GCM-256, from PBKDF2-SHA256. */
export type VaultKey = {
    encrypt: (plain: Uint8Array<ArrayBuffer>) => Promise<{iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer>}>;
    /** Throws WrongPasswordError when the key doesn't fit: AES-GCM's own check rejects it. */
    decrypt: (iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) => Promise<Uint8Array>;
};

export class WrongPasswordError extends Error {
    constructor () {
        super("Wrong password.");
        this.name = "WrongPasswordError";
    }
}

const KEY_BYTES = 32;
const IV_BYTES = 12;

/** Browsers drop crypto.subtle on a page opened over plain http from another computer (and may on other origins). */
export const hasWebCrypto = (): boolean => typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";

/** Random bytes: crypto.getRandomValues, which every page has, secure or not. */
export const randomBytes = (length: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(length));

/**
 * The key for a password and salt. Web Crypto where the page has it; otherwise the same PBKDF2-SHA256 and AES-GCM in
 * code (@noble), so a vault written by either opens with the other. Deriving takes about half a second with Web
 * Crypto at 600,000 iterations (longer in code): that cost is what slows down guessing.
 */
export async function deriveVaultKey (password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, useWebCrypto = hasWebCrypto()): Promise<VaultKey> {
    const passwordBytes = new TextEncoder().encode(password);

    if (useWebCrypto) {
        const base = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey(
            {name: "PBKDF2", salt, iterations, hash: "SHA-256"},
            base,
            {name: "AES-GCM", length: 256},
            false,
            ["encrypt", "decrypt"]
        );

        return {
            encrypt: async (plain) => {
                const iv = randomBytes(IV_BYTES);

                return {iv, data: new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, plain))};
            },
            decrypt: async (iv, data) => {
                try {
                    return new Uint8Array(await crypto.subtle.decrypt({name: "AES-GCM", iv}, key, data));
                } catch {
                    throw new WrongPasswordError();
                }
            },
        };
    }

    const key = await pbkdf2Async(sha256, passwordBytes, salt, {c: iterations, dkLen: KEY_BYTES});

    return {
        encrypt: (plain) => {
            const iv = randomBytes(IV_BYTES);

            return Promise.resolve({iv, data: new Uint8Array(gcm(key, iv).encrypt(plain))});
        },
        decrypt: (iv, data) => {
            try {
                return Promise.resolve(gcm(key, iv).decrypt(data));
            } catch {
                return Promise.reject(new WrongPasswordError());
            }
        },
    };
}
