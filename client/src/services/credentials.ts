/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactElement} from "react";


/** Where a custom credential is kept: `credential.<name>`, apart from every key the app itself uses. */
export const CUSTOM_CREDENTIAL_PREFIX = "credential.";

/** What a custom credential may be called. */
export const CREDENTIAL_NAME = /^[A-Za-z0-9_.-]+$/;

/** A node or tool descriptor, as far as its credentials go. */
export type CredentialOwner = {
    title: string;
    icon: ReactElement;
    globalSecrets?: readonly string[];
};

/** A credential nodes or tools fall back to: its store key, and everything that declares it. */
export type KnownCredential = {
    key: string;
    /** None for a custom credential. */
    owners: CredentialOwner[];
};

/** The declared credentials: one per store key, however many declare it, in the order first declared. */
export function knownCredentials (owners: readonly CredentialOwner[]): KnownCredential[] {
    const byKey = new Map<string, CredentialOwner[]>();

    for (const owner of owners) {
        for (const key of owner.globalSecrets ?? []) byKey.set(key, [...(byKey.get(key) ?? []), owner]);
    }

    return [...byKey].map(([key, declaredBy]) => ({key, owners: declaredBy}));
}

/** The store key a credential is saved under: its own for a declared one, a prefixed one for a custom one. */
export function credentialStoreKey (name: string, known: readonly KnownCredential[]): string {
    return known.some(credential => credential.key === name) ? name : `${CUSTOM_CREDENTIAL_PREFIX}${name}`;
}

/** The names of the custom credentials among the store's keys, sorted. */
export function customCredentialNames (storeKeys: readonly string[]): string[] {
    return storeKeys
        .filter(key => key.startsWith(CUSTOM_CREDENTIAL_PREFIX))
        .map(key => key.slice(CUSTOM_CREDENTIAL_PREFIX.length))
        .sort();
}
