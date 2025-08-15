/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import {Tooltip} from "@mui/material";


type DockItemProps = {
    title: string;
    icon: React.ReactElement<{className?: string}>;
    onClick: () => void;
    ariaLabel?: string;
};

export const DockItem = ({title, icon, onClick, ariaLabel}: DockItemProps) => {
    return (
        <Tooltip title={title} placement="bottom" arrow>
            <div className="dock-item" tabIndex={0} aria-label={ariaLabel || title} onClick={onClick} role="button">
                <div className="dock-item-icon-wrapper">
                    {React.cloneElement(icon, {className: "dock-item-icon"})}
                </div>
            </div>
        </Tooltip>
    );
};
