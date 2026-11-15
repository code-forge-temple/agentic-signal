/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from "react";
import {useSnackbar} from "notistack";
import {CommandsNetworkAccess, fetchCommandsNetworkAccess, setCommandsNetworkAccess} from "../services/outsideCommandsService";
import {errorMessage} from "@shared/utils";


/**
 * Whether other computers may call workflow commands, and on which addresses; `access` is null until the backend
 * answers (or if it can't). `setEnabled` opens or closes the port, and says so if the backend refuses.
 */
export function useCommandsNetworkAccess () {
    const {enqueueSnackbar} = useSnackbar();
    const [access, setAccess] = useState<CommandsNetworkAccess | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchCommandsNetworkAccess()
            .then((answer) => {
                if (!cancelled) setAccess(answer);
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, []);

    const setEnabled = (enabled: boolean) => {
        setSaving(true);
        void setCommandsNetworkAccess(enabled)
            .then(setAccess)
            .catch((error: unknown) => enqueueSnackbar(`Couldn't change it: ${errorMessage(error)}`, {variant: "error"}))
            .finally(() => setSaving(false));
    };

    return {access, saving, setEnabled};
}
