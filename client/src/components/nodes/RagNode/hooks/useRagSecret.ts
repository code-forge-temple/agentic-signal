/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback} from "react";
import {useGlobalConfig} from "../../../../stores/globalConfig";
import {useOnMount} from "../../../../hooks/useOnMount";
import {GLOBAL_SECRETS} from "../constants";


/**
 * One of the RAG node's secrets (the Weaviate API key, the owner key), shared by every RAG node under its global store
 * key; Settings → Credentials keeps it after a reload. A value in an older workflow file (saved before secrets were
 * stripped) becomes the shared one, if none is set yet.
 */
export function useRagSecret (key: typeof GLOBAL_SECRETS[keyof typeof GLOBAL_SECRETS], savedValue: string | undefined) {
    const {globalData, setGlobalData} = useGlobalConfig();
    const value: string = globalData[key] || "";
    const setValue = useCallback((next: string) => setGlobalData(key, next), [key, setGlobalData]);

    // Once, when the node mounts: a value cleared later in Settings must stay cleared.
    useOnMount(() => {
        if (!value && savedValue) setValue(savedValue);
    });

    return [value, setValue] as const;
}
