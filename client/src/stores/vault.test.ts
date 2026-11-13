/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {beforeEach, describe, expect, it} from "vitest";
import {
    changeVaultPassword,
    createVaultWith,
    dismissVaultPrompt,
    lockVault,
    requestVaultAccess,
    resetVault,
    unlockVault,
    updateVault,
    useVaultStore,
} from "./vault";
import {useGlobalConfig} from "./globalConfig";
import {VAULT_STORAGE_KEY} from "../services/vault/vault";
import {WrongPasswordError} from "../services/vault/crypto";
import {COMMAND_CONNECTIONS_KEY} from "../services/commandConnections";


const PASSWORD = "correct horse";
// A password change derives the key three or four times (600,000 rounds each): slow while the whole suite runs.
const PASSWORD_CHANGE_TIMEOUT_MS = 30_000;
const globalValue = (key: string) => useGlobalConfig.getState().globalData[key];

describe("vault store", () => {
    beforeEach(() => {
        localStorage.clear();
        useVaultStore.setState({file: null, key: null, secrets: null, prompt: null});
        useGlobalConfig.setState({globalData: {}});
    });

    it("asks for a new password when there's no vault, and grants access once it's made", async () => {
        const access = requestVaultAccess();

        expect(useVaultStore.getState().prompt).toBe("create");

        await createVaultWith(PASSWORD);

        await expect(access).resolves.toBe(true);
        expect(useVaultStore.getState().prompt).toBeNull();
        expect(localStorage.getItem(VAULT_STORAGE_KEY)).not.toBeNull();
    });

    it("answers false when the popup is closed", async () => {
        const access = requestVaultAccess();

        dismissVaultPrompt();

        await expect(access).resolves.toBe(false);
    });

    it("unlocking puts the saved credentials in the app, but keeps a value typed before it", async () => {
        await createVaultWith(PASSWORD, {credentials: {slackBotToken: "saved", weaviateApiKey: "saved-w"}, connectionTokens: {}});
        lockVault();

        expect(globalValue("slackBotToken")).toBe("");

        useGlobalConfig.getState().setGlobalData("weaviateApiKey", "typed");

        const access = requestVaultAccess();

        expect(useVaultStore.getState().prompt).toBe("unlock");

        await unlockVault(PASSWORD);

        await expect(access).resolves.toBe(true);
        expect(globalValue("slackBotToken")).toBe("saved");
        expect(globalValue("weaviateApiKey")).toBe("typed");
    });

    it("refuses a wrong password and stays locked", async () => {
        await createVaultWith(PASSWORD);
        lockVault();

        await expect(unlockVault("wrong horse")).rejects.toBeInstanceOf(WrongPasswordError);
        expect(useVaultStore.getState().key).toBeNull();
    });

    it("saves changes encrypted, never in the global store's persisted keys", async () => {
        await createVaultWith(PASSWORD);
        await updateVault(secrets => ({...secrets, credentials: {slackBotToken: "xoxb-1"}}));

        const stored = JSON.stringify({...localStorage});

        expect(stored).not.toContain("xoxb-1");
        expect(useVaultStore.getState().file?.credentialKeys).toEqual(["slackBotToken"]);
    });

    it("reset deletes the vault, the saved credentials' values and the outside connections", async () => {
        await createVaultWith(PASSWORD, {credentials: {slackBotToken: "saved"}, connectionTokens: {c1: "as_1"}});
        useGlobalConfig.getState().setGlobalData(COMMAND_CONNECTIONS_KEY, JSON.stringify([{id: "c1", name: "App", commands: [], tokenHash: "h"}]), true);

        resetVault();

        expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
        expect(useVaultStore.getState().file).toBeNull();
        expect(globalValue("slackBotToken")).toBe("");
        expect(globalValue(COMMAND_CONNECTIONS_KEY)).toBe("");
    });

    it("changing the password of a locked vault unlocks it, as Unlock would", async () => {
        await createVaultWith(PASSWORD, {credentials: {slackBotToken: "saved"}, connectionTokens: {}});
        lockVault();

        const access = requestVaultAccess();

        await changeVaultPassword(PASSWORD, "battery staple");

        await expect(access).resolves.toBe(true);
        expect(useVaultStore.getState().prompt).toBeNull();
        expect(globalValue("slackBotToken")).toBe("saved");

        lockVault();
        await unlockVault("battery staple");

        expect(globalValue("slackBotToken")).toBe("saved");
    }, PASSWORD_CHANGE_TIMEOUT_MS);

    it("changing the password of an open vault leaves a value the user cleared cleared", async () => {
        await createVaultWith(PASSWORD, {credentials: {slackBotToken: "saved"}, connectionTokens: {}});
        useGlobalConfig.getState().setGlobalData("slackBotToken", "");

        await changeVaultPassword(PASSWORD, "battery staple");

        expect(globalValue("slackBotToken")).toBe("");
    }, PASSWORD_CHANGE_TIMEOUT_MS);

    it("locks when another tab changes the vault, keeping the values already in the app", async () => {
        await createVaultWith(PASSWORD, {credentials: {slackBotToken: "saved"}, connectionTokens: {}});

        window.dispatchEvent(new StorageEvent("storage", {key: VAULT_STORAGE_KEY}));

        expect(useVaultStore.getState().key).toBeNull();
        expect(useVaultStore.getState().file).not.toBeNull();
        expect(globalValue("slackBotToken")).toBe("saved");
    });
});
