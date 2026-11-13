/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import {Key} from "iconoir-react";
import {CredentialOwner} from "../../../../../../../services/credentials";


/** The icons of the nodes and tools that use a credential, each naming its owner on hover; a key for a custom one. */
export function CredentialIcons ({owners}: {owners: CredentialOwner[]}) {
    const icons = owners.length > 0 ? owners.map(owner => ({label: owner.title, icon: owner.icon})) : [{label: "Custom", icon: <Key />}];

    return (
        <Box component="span" sx={{display: "inline-flex", gap: 0.5, flexShrink: 0, "& svg": {width: 18, height: 18}}}>
            {icons.map(({label, icon}) => (
                <Tooltip key={label} title={label}>
                    <Box component="span" aria-label={label} sx={{display: "inline-flex"}}>{icon}</Box>
                </Tooltip>
            ))}
        </Box>
    );
}
