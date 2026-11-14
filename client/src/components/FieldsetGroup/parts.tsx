/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import {ArrowDownCircleSolid, ArrowUpCircleSolid, ExpandLines} from "iconoir-react";

/** The arrow on the frame's top-right corner that collapses or expands the group. */
export function CollapseToggle ({isCollapsed, onToggle}: {isCollapsed: boolean; onToggle: () => void}) {
    return (
        <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            sx={{
                position: 'absolute',
                top: 0,
                right: 8,
                marginTop: '-22px',
                p: 0.25,
            }}
        >
            {isCollapsed ? <ArrowDownCircleSolid width={24} height={24} /> : <ArrowUpCircleSolid width={24} height={24} />}
        </IconButton>
    );
}

/** What a collapsed group shows instead of its fields: a button that expands it. */
export function CollapsedPlaceholder ({onExpand}: {onExpand: () => void}) {
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', py: 0.5, marginTop: '-25px', marginBottom: '-13px'}}>
            <IconButton size="small" onClick={onExpand} aria-label="Expand">
                <ExpandLines width={20} height={20} />
            </IconButton>
        </Box>
    );
}
