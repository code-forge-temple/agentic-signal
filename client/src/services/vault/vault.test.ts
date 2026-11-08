/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from "vitest";
import {createVault, openVault, parseVaultFile, resealVault, VaultSecrets} from "./vault";
import {WrongPasswordError} from "./crypto";


// Few rounds keep the tests fast; the format and the crypto are the same at 600,000.
const FAST = {iterations: 1_000};
const SECRETS: VaultSecrets = {credentials: {slackBotToken: "xoxb-1", "credential.MY_KEY": "abc"}, connectionTokens: {"conn-1": "as_123"}};

describe("vault", () => {
    it("opens with the password it was made with", async () => {
        const {file} = await createVault("correct horse", SECRETS, FAST);
        const {secrets} = await openVault(file, "correct horse");

        expect(secrets).toEqual(SECRETS);
    });

    it("refuses a wrong password", async () => {
        const {file} = await createVault("correct horse", SECRETS, FAST);

        await expect(openVault(file, "wrong horse")).rejects.toBeInstanceOf(WrongPasswordError);
    });

    it("keeps no secret, and no password, readable", async () => {
        const {file} = await createVault("correct horse", SECRETS, FAST);
        const stored = JSON.stringify(file);

        for (const plain of ["correct horse", "xoxb-1", "abc", "as_123", "conn-1"]) expect(stored).not.toContain(plain);

        expect(file.credentialKeys).toEqual(["credential.MY_KEY", "slackBotToken"]);
    });

    it("opens what the in-code fallback wrote, and the other way round", async () => {
        const fromFallback = await createVault("correct horse", SECRETS, {...FAST, useWebCrypto: false});
        const fromWebCrypto = await createVault("correct horse", SECRETS, {...FAST, useWebCrypto: true});

        expect((await openVault(fromFallback.file, "correct horse", {useWebCrypto: true})).secrets).toEqual(SECRETS);
        expect((await openVault(fromWebCrypto.file, "correct horse", {useWebCrypto: false})).secrets).toEqual(SECRETS);
        await expect(openVault(fromWebCrypto.file, "wrong horse", {useWebCrypto: false})).rejects.toBeInstanceOf(WrongPasswordError);
    });

    it("reseals new contents under the same password, with a new iv", async () => {
        const {file, key} = await createVault("correct horse", SECRETS, FAST);
        const changed: VaultSecrets = {...SECRETS, credentials: {weaviateApiKey: "w-1"}};
        const resealed = await resealVault(file, key, changed);

        expect(resealed.salt).toBe(file.salt);
        expect(resealed.iv).not.toBe(file.iv);
        expect((await openVault(resealed, "correct horse")).secrets).toEqual(changed);
        expect(resealed.credentialKeys).toEqual(["weaviateApiKey"]);
    });

    it("reads back only a well-formed vault", async () => {
        const {file} = await createVault("correct horse", SECRETS, FAST);

        expect(parseVaultFile(JSON.stringify(file))).toEqual(file);
        expect(parseVaultFile(null)).toBeNull();
        expect(parseVaultFile("not json")).toBeNull();
        expect(parseVaultFile(JSON.stringify({...file, version: 2}))).toBeNull();
        expect(parseVaultFile(JSON.stringify({...file, credentialKeys: [1]}))).toBeNull();
    });
});
