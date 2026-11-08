/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {create} from "zustand";
import {VaultKey} from "../services/vault/crypto";
import {createVault, EMPTY_SECRETS, openVault, parseVaultFile, resealVault, VAULT_STORAGE_KEY, VaultFile, VaultSecrets} from "../services/vault/vault";
import {COMMAND_CONNECTIONS_KEY} from "../services/commandConnections";
import {useGlobalConfig} from "./globalConfig";


/** What the popup asks for: a new password, or the password. */
export type VaultPrompt = "create" | "unlock";

/** What the vault is opened for, so the popup can say so: saving a credential, or adding an outside connection. */
export type VaultPurpose = "credential" | "connection";

type VaultState = {
    /** The stored vault; null until the first credential or outside connection is saved. */
    file: VaultFile | null;
    /** In memory only, from unlocking until the app reloads (or Lock now). */
    key: VaultKey | null;
    secrets: VaultSecrets | null;
    prompt: VaultPrompt | null;
    purpose: VaultPurpose | null;
};

const hasLocalStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readFile = (): VaultFile | null => {
    if (!hasLocalStorage()) return null;

    try {
        return parseVaultFile(localStorage.getItem(VAULT_STORAGE_KEY));
    } catch {
        return null;
    }
};

// Throws when storage refuses (full, or blocked): the caller reports it rather than losing the secret silently.
const writeFile = (file: VaultFile | null) => {
    if (!hasLocalStorage()) throw new Error("This browser keeps no storage for the vault.");

    if (file) localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(file));
    else localStorage.removeItem(VAULT_STORAGE_KEY);
};

export const useVaultStore = create<VaultState>(() => ({file: readFile(), key: null, secrets: null, prompt: null, purpose: null}));

// Callers waiting on the popup (requestVaultAccess): told when it ends, opened or not.
let waiting: ((granted: boolean) => void)[] = [];

const settle = (granted: boolean) => {
    const resolvers = waiting;

    waiting = [];
    resolvers.forEach(resolve => resolve(granted));
};

// The saved credentials go into the global store for the session, where nodes read them. A value typed into a node
// before unlocking wins.
const applyCredentials = (credentials: Record<string, string>) => {
    const {globalData, setGlobalData} = useGlobalConfig.getState();

    for (const [key, value] of Object.entries(credentials)) {
        if (!globalData[key]) setGlobalData(key, value);
    }
};

const clearCredentials = (keys: readonly string[]) => {
    const {setGlobalData} = useGlobalConfig.getState();

    for (const key of keys) setGlobalData(key, "");
};

/**
 * Resolves true once the vault is open: at once if it is, otherwise after the popup asks for the password (or, with no
 * vault yet, for a new one). False if the user closes it.
 */
export function requestVaultAccess (purpose: VaultPurpose | null = null): Promise<boolean> {
    const {key, file} = useVaultStore.getState();

    if (key) return Promise.resolve(true);

    useVaultStore.setState({prompt: file ? "unlock" : "create", purpose});

    return new Promise(resolve => waiting.push(resolve));
}

/** Closes the popup without opening the vault (Not now, Cancel). */
export function dismissVaultPrompt (): void {
    useVaultStore.setState({prompt: null});
    settle(false);
}

/** Makes the vault with a new password, holding `secrets`, and keeps it open. */
export async function createVaultWith (password: string, secrets: VaultSecrets = EMPTY_SECRETS): Promise<void> {
    const {file, key} = await createVault(password, secrets);

    writeFile(file);
    useVaultStore.setState({file, key, secrets, prompt: null});
    applyCredentials(secrets.credentials);
    settle(true);
}

/** Opens the vault. Throws WrongPasswordError for a wrong password. */
export async function unlockVault (password: string): Promise<void> {
    const {file} = useVaultStore.getState();

    if (!file) throw new Error("There is no vault to unlock.");

    const {key, secrets} = await openVault(file, password);

    useVaultStore.setState({key, secrets, prompt: null});
    applyCredentials(secrets.credentials);
    settle(true);
}

/** Lock now: forgets the key, and takes the saved credentials' values out of the app until the next unlock. */
export function lockVault (): void {
    clearCredentials(useVaultStore.getState().file?.credentialKeys ?? []);
    useVaultStore.setState({key: null, secrets: null});
}

/** Changes what the vault holds. It must be open: ask with requestVaultAccess first. */
export async function updateVault (change: (secrets: VaultSecrets) => VaultSecrets): Promise<VaultSecrets> {
    const {file, key, secrets} = useVaultStore.getState();

    if (!file || !key || !secrets) throw new Error("The vault is locked.");

    const next = change(secrets);
    const resealed = await resealVault(file, key, next);

    writeFile(resealed);
    useVaultStore.setState({file: resealed, secrets: next});

    return next;
}

/**
 * A new password: the current one opens the vault, which is then made again (new salt) under the new one. It stays
 * open afterwards, so on a locked vault this unlocks it, as Unlock would.
 */
export async function changeVaultPassword (current: string, next: string): Promise<void> {
    const {file} = useVaultStore.getState();

    if (!file) throw new Error("There is no vault.");

    const {secrets} = await openVault(file, current);
    const created = await createVault(next, secrets);
    const wasLocked = useVaultStore.getState().key === null;

    writeFile(created.file);
    useVaultStore.setState({file: created.file, key: created.key, secrets, prompt: null});

    // While it was open, the saved values were already in the app, and one the user cleared since must stay cleared.
    if (wasLocked) applyCredentials(secrets.credentials);

    settle(true);
}

/**
 * For a forgotten password: deletes the vault, takes the saved credentials out of the app, and removes the outside
 * connections, since their tokens are gone with the vault and an app can't be given them again.
 */
export function resetVault (): void {
    clearCredentials(useVaultStore.getState().file?.credentialKeys ?? []);
    writeFile(null);
    useGlobalConfig.getState().setGlobalData(COMMAND_CONNECTIONS_KEY, "", true);
    useVaultStore.setState({file: null, key: null, secrets: null, prompt: null});
    settle(false);
}

// Another tab changed the vault (a save, a new password, a reset): this tab's key may no longer fit, and saving with it
// would overwrite that change. So this tab locks. The values already in the app stay for the session, so nothing
// that's running stops.
if (hasLocalStorage()) {
    window.addEventListener("storage", (event) => {
        if (event.key !== VAULT_STORAGE_KEY && event.key !== null) return;

        useVaultStore.setState({file: readFile(), key: null, secrets: null});
    });
}
