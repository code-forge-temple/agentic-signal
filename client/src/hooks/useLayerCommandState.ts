/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useSyncExternalStore} from "react";
import {CommandRouter} from "../services/commandRouter";


/** What a layer is doing for a workflow command: idle, serving one, or how the last one ended. */
export function useLayerCommandState (layerId: string) {
    const router = CommandRouter.getInstance();
    const getState = useCallback(() => router.getLayerState(layerId), [router, layerId]);

    return useSyncExternalStore(router.subscribe, getState);
}
