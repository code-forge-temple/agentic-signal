/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useMemo} from "react";
import {nodeRegistry} from "../components/nodes/nodeRegistry.gen";
import {toolRegistry} from "../components/nodes/ToolNode/tools/toolRegistry.gen";
import {useGlobalConfig} from "../stores/globalConfig";
import {requestVaultAccess, updateVault, useVaultStore} from "../stores/vault";
import {credentialStoreKey, CUSTOM_CREDENTIAL_PREFIX, KnownCredential, knownCredentials} from "../services/credentials";


/**
 * The credentials Settings saves, and saving or removing one. They're kept in the vault, encrypted with the user's
 * password; unlocking puts them in the global store for the session, where nodes read them.
 */
export function useCredentials () {
    const {setGlobalData} = useGlobalConfig();
    const known = useMemo(() => knownCredentials([...nodeRegistry, ...toolRegistry]), []);
    const savedKeys = useVaultStore(state => state.file?.credentialKeys);
    const locked = useVaultStore(state => state.file !== null && state.key === null);

    // The vault lists its keys without its values: the declared ones in the order they're declared, then the custom ones.
    const saved: KnownCredential[] = useMemo(() => {
        const keys = new Set(savedKeys ?? []);
        const declared = known.filter(({key}) => keys.has(key));
        const others = [...keys]
            .filter(key => !declared.some(credential => credential.key === key))
            .map(key => (key.startsWith(CUSTOM_CREDENTIAL_PREFIX) ? key.slice(CUSTOM_CREDENTIAL_PREFIX.length) : key))
            .sort()
            .map(key => ({key, owners: []}));

        return [...declared, ...others];
    }, [known, savedKeys]);

    /** False when the vault stays locked (the user closed the password popup). */
    const save = useCallback(async (name: string, value: string): Promise<boolean> => {
        if (!(await requestVaultAccess("credential"))) return false;

        const storeKey = credentialStoreKey(name, known);

        await updateVault(secrets => ({...secrets, credentials: {...secrets.credentials, [storeKey]: value}}));
        setGlobalData(storeKey, value);

        return true;
    }, [known, setGlobalData]);

    const remove = useCallback(async (name: string): Promise<boolean> => {
        if (!(await requestVaultAccess())) return false;

        const storeKey = credentialStoreKey(name, known);

        await updateVault(secrets => ({
            ...secrets,
            credentials: Object.fromEntries(Object.entries(secrets.credentials).filter(([key]) => key !== storeKey)),
        }));
        setGlobalData(storeKey, "");

        return true;
    }, [known, setGlobalData]);

    return {known, saved, save, remove, locked};
}
