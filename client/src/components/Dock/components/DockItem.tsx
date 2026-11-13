/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import Tooltip from "@mui/material/Tooltip";


type DockItemProps = {
    title: string;
    icon: React.ReactElement<{className?: string}>;
    onClick: () => void;
    ariaLabel?: string;
    /** Set when the item can't be used right now; the tooltip then says why. */
    disabledReason?: string;
};

export const DockItem = ({title, icon, onClick, ariaLabel, disabledReason}: DockItemProps) => {
    const disabled = disabledReason !== undefined;

    return (
        <Tooltip title={disabled ? `${title}: ${disabledReason}` : title} placement="bottom" arrow>
            <div
                className={`dock-item${disabled ? " disabled" : ""}`}
                tabIndex={disabled ? -1 : 0}
                aria-label={ariaLabel || title}
                aria-disabled={disabled}
                onClick={disabled ? undefined : onClick}
                role="button"
            >
                <div className="dock-item-icon-wrapper">
                    {React.cloneElement(icon, {className: "dock-item-icon"})}
                </div>
            </div>
        </Tooltip>
    );
};
