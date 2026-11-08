/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useMemo} from "react";
import {v4 as uuidv4} from "uuid";
import {useGlobalConfig} from "../stores/globalConfig";
import {requestVaultAccess, updateVault, useVaultStore} from "../stores/vault";
import {COMMAND_CONNECTIONS_KEY, CommandConnection, newCommandToken, parseCommandConnections, sha256Hex} from "../services/commandConnections";


/**
 * The outside apps allowed to call workflow commands, and adding or removing one. A connection's token is kept in the
 * vault; the list keeps only its hash, so outside calls work while the vault is locked.
 */
export function useCommandConnections () {
    const {globalData, setGlobalData} = useGlobalConfig();
    const raw = globalData[COMMAND_CONNECTIONS_KEY];
    const connections = useMemo(() => parseCommandConnections(raw), [raw]);
    const tokens = useVaultStore(state => state.secrets?.connectionTokens);

    const save = useCallback((next: CommandConnection[]) => {
        setGlobalData(COMMAND_CONNECTIONS_KEY, JSON.stringify(next), true);
    }, [setGlobalData]);

    /** Its token, for the user to copy; null when the vault stays locked. Asks for the password if needed. */
    const getToken = useCallback(async (connection: CommandConnection): Promise<string | null> => {
        if (connection.token) return connection.token;

        if (!(await requestVaultAccess())) return null;

        return useVaultStore.getState().secrets?.connectionTokens[connection.id] ?? null;
    }, []);

    /** Adds a connection with a new token and returns the token; null if the vault wasn't opened. */
    const addConnection = useCallback(async (name: string, commands: string[]): Promise<string | null> => {
        if (!(await requestVaultAccess("connection"))) return null;

        // Not crypto.randomUUID: browsers only offer it on secure pages, and the app may be opened over plain
        // http from another computer.
        const id = uuidv4();
        const token = newCommandToken();
        const tokenHash = await sha256Hex(token);
        const current = parseCommandConnections(useGlobalConfig.getState().globalData[COMMAND_CONNECTIONS_KEY]);
        const ids = new Set([...current.map(connection => connection.id), id]);

        // Tokens of connections removed while the vault was locked go now.
        await updateVault(secrets => ({
            ...secrets,
            connectionTokens: Object.fromEntries([...Object.entries(secrets.connectionTokens).filter(([key]) => ids.has(key)), [id, token]]),
        }));
        save([...current, {id, name: name.trim(), commands, tokenHash}]);

        return token;
    }, [save]);

    /** Removing never needs the password: it cuts the app off at once. Its token leaves the vault now if it's open. */
    const removeConnection = useCallback((id: string) => {
        save(connections.filter(connection => connection.id !== id));

        if (useVaultStore.getState().key) {
            void updateVault(secrets => ({
                ...secrets,
                connectionTokens: Object.fromEntries(Object.entries(secrets.connectionTokens).filter(([key]) => key !== id)),
            })).catch(() => {});
        }
    }, [connections, save]);

    return {connections, tokens, getToken, addConnection, removeConnection};
}
