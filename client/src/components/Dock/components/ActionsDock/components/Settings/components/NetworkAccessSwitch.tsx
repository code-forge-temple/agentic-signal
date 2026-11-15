/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import {CommandsNetworkAccess} from "../../../../../../../services/outsideCommandsService";


/** The line under the switch: who can call. The URLs to call are in the fields below it. */
function describeAccess ({enabled, lockedBy}: CommandsNetworkAccess): string {
    const lock = lockedBy ? ` ${lockedBy} decides this: the backend was started with it.` : "";

    if (!enabled) return `Only this computer can call.${lock}`;

    return `Other computers on your network can call too. Calls travel as plain HTTP, so keep this for networks you trust.${lock}`;
}

type NetworkAccessSwitchProps = {
    access: CommandsNetworkAccess;
    /** While the backend reopens the port, the switch waits. */
    saving: boolean;
    onChange: (enabled: boolean) => void;
};

/** Whether apps on other computers may call workflow commands: opens the commands port to the network. */
export function NetworkAccessSwitch ({access, saving, onChange}: NetworkAccessSwitchProps) {
    return (
        <Box sx={{my: 1}}>
            <FormControlLabel
                control={<Switch checked={access.enabled} disabled={saving || access.lockedBy !== null} onChange={(_event, checked) => onChange(checked)} />}
                label="Accept calls from other computers on your network"
            />
            <Typography variant="caption" color="text.secondary" component="p">{describeAccess(access)}</Typography>
        </Box>
    );
}
