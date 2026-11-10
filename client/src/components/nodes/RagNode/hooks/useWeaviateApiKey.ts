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
 * The Weaviate API key, shared by every RAG node; Settings → Credentials keeps it after a reload. A key in an older
 * workflow file (saved before keys were stripped) becomes the shared one, if none is set yet.
 */
export function useWeaviateApiKey (savedKey: string | undefined) {
    const {globalData, setGlobalData} = useGlobalConfig();
    const apiKey: string = globalData[GLOBAL_SECRETS.API_KEY] || "";
    const setApiKey = useCallback((value: string) => setGlobalData(GLOBAL_SECRETS.API_KEY, value), [setGlobalData]);

    // Once, when the node mounts: a key cleared later in Settings must stay cleared.
    useOnMount(() => {
        if (!apiKey && savedKey) setApiKey(savedKey);
    });

    return [apiKey, setApiKey] as const;
}
