/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from "react";
import {Box, FormControlLabel, Switch, Typography} from "@mui/material";
import {useSnackbar} from "notistack";
import {CommandsNetworkAccess, fetchCommandsNetworkAccess, setCommandsNetworkAccess} from "../../../../../../../services/outsideCommandsService";
import {errorMessage} from "@shared/utils";


/** The line under the switch: who can call, and on which address. */
function describeAccess ({enabled, lockedBy, port, addresses}: CommandsNetworkAccess): string {
    const lock = lockedBy ? ` ${lockedBy} decides this: the backend was started with it.` : "";

    if (!enabled) return `Only this computer can call.${lock}`;

    const where = addresses.map(address => `http://${address}:${port}/workflows/<command>`).join(" or ");

    return `${where ? `Other computers on your network call ${where}.` : "Other computers on your network can call."} `
        + `Calls travel as plain HTTP, so keep this for networks you trust.${lock}`;
}

/** Whether apps on other computers may call workflow commands: opens the commands port to the network. */
export function NetworkAccessSwitch () {
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

    // Until the backend answers (or if it can't), there's nothing to switch.
    if (!access) return null;

    const handleChange = (enabled: boolean) => {
        setSaving(true);
        void setCommandsNetworkAccess(enabled)
            .then(setAccess)
            .catch((error: unknown) => enqueueSnackbar(`Couldn't change it: ${errorMessage(error)}`, {variant: "error"}))
            .finally(() => setSaving(false));
    };

    return (
        <Box sx={{my: 1}}>
            <FormControlLabel
                control={<Switch checked={access.enabled} disabled={saving || access.lockedBy !== null} onChange={(_event, checked) => handleChange(checked)} />}
                label="Accept calls from other computers on your network"
            />
            <Typography variant="caption" color="text.secondary" component="p">{describeAccess(access)}</Typography>
        </Box>
    );
}
