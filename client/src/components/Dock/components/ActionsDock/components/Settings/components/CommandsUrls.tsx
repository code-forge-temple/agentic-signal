/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import {Copy} from "iconoir-react";
import {useSnackbar} from "notistack";
import {CommandsNetworkAccess} from "../../../../../../../services/outsideCommandsService";
import {copyText} from "../../../../../../../utils/clipboard";


type CommandsUrl = {label: string; url: string};

/**
 * The URLs outside apps call: this computer's, and while the port is open to the network, one per address other
 * computers reach this one on (an address the backend was started with is this computer's URL already).
 */
function commandsUrls (endpoint: string, access: CommandsNetworkAccess | null): CommandsUrl[] {
    if (!access?.enabled) return [{label: "URL", url: endpoint}];

    const networkUrls = access.addresses
        .map(address => `http://${address}:${access.port}/workflows/`)
        .filter(url => url !== endpoint);

    return [
        {label: "URL for this computer", url: endpoint},
        ...networkUrls.map(url => ({label: "URL for other computers", url})),
    ];
}

/* A read-only field with the URL, so it can be read and selected too, and a button that copies it. */
function CopyableUrl ({label, url}: CommandsUrl) {
    const {enqueueSnackbar} = useSnackbar();

    const handleCopy = () => {
        copyText(url)
            .then(() => enqueueSnackbar("URL copied.", {variant: "success"}))
            .catch(() => enqueueSnackbar("Couldn't copy the URL.", {variant: "error"}));
    };

    return (
        <TextField
            size="small"
            fullWidth
            label={label}
            value={url}
            slotProps={{
                htmlInput: {title: url},
                input: {
                    readOnly: true,
                    endAdornment: (
                        <InputAdornment position="end">
                            <Tooltip title="Copy URL">
                                <IconButton size="small" edge="end" aria-label={`Copy ${url}`} onClick={handleCopy}>
                                    <Copy style={{fontSize: 16}} />
                                </IconButton>
                            </Tooltip>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}

type CommandsUrlsProps = {
    /** Where apps on this computer call, from the backend. */
    endpoint: string;
    /** Adds the network's URLs while the port is open to it. */
    access: CommandsNetworkAccess | null;
};

/** Where outside apps send their calls, each URL with a button to copy it. A command's name goes after it. */
export function CommandsUrls ({endpoint, access}: CommandsUrlsProps) {
    return (
        <Box sx={{display: "flex", flexDirection: "column", gap: 1.5, mt: 1, mb: 2}}>
            {commandsUrls(endpoint, access).map(({label, url}) => <CopyableUrl key={url} label={label} url={url} />)}
        </Box>
    );
}
