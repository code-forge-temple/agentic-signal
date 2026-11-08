/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {requestVaultAccess, useVaultStore} from "../stores/vault";


/**
 * At startup, when there is a vault, the popup asks for its password (Not now leaves it locked). With no vault there's
 * nothing to unlock, so nobody without saved secrets ever sees it. Mounted once, for the app.
 */
export function useVaultStartup (): void {
    useEffect(() => {
        if (useVaultStore.getState().file) void requestVaultAccess();
    }, []);
}
