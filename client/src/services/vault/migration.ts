/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {nodeRegistry} from "../../components/nodes/nodeRegistry.gen";
import {toolRegistry} from "../../components/nodes/ToolNode/tools/toolRegistry.gen";
import {forgetPersistedGlobalData, getPersistedValue, persistedGlobalDataKeys, useGlobalConfig} from "../../stores/globalConfig";
import {createVaultWith} from "../../stores/vault";
import {COMMAND_CONNECTIONS_KEY, parseCommandConnections, sha256Hex} from "../commandConnections";
import {CUSTOM_CREDENTIAL_PREFIX, knownCredentials} from "../credentials";


/** Declared or custom credentials persisted in plain text, outside the vault (Slack nodes used to save their tokens so). */
function plaintextCredentials (): Record<string, string> {
    const known = new Set(knownCredentials([...nodeRegistry, ...toolRegistry]).map(({key}) => key));
    const credentials: Record<string, string> = {};

    for (const key of persistedGlobalDataKeys()) {
        if (!known.has(key) && !key.startsWith(CUSTOM_CREDENTIAL_PREFIX)) continue;

        const value = getPersistedValue(key);

        if (value) credentials[key] = value;
    }

    return credentials;
}

/**
 * Creates the vault under `password`, taking along any secrets still kept in plain text: persisted credentials, and
 * outside connections holding their token. Afterwards those credentials are no longer persisted in plain text (they
 * stay in the app for the session), and each connection keeps only its token's hash, all the backend ever gets.
 */
export async function createVaultKeepingSaved (password: string): Promise<void> {
    const credentials = plaintextCredentials();
    const connections = parseCommandConnections(getPersistedValue(COMMAND_CONNECTIONS_KEY));
    // Hashed first: nothing changes unless every step before the vault's creation worked.
    const rewritten = await Promise.all(connections.map(async ({id, name, commands, token, tokenHash}) => ({
        id, name, commands, tokenHash: tokenHash ?? await sha256Hex(token ?? ""),
    })));
    const connectionTokens = Object.fromEntries(connections.flatMap(({id, token}) => (token ? [[id, token]] : [])));

    await createVaultWith(password, {credentials, connectionTokens});

    for (const key of Object.keys(credentials)) forgetPersistedGlobalData(key);

    if (connections.some(({token}) => token)) {
        useGlobalConfig.getState().setGlobalData(COMMAND_CONNECTIONS_KEY, JSON.stringify(rewritten), true);
    }
}
