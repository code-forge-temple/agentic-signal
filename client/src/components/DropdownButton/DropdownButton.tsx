/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import * as React from 'react';
import Button, {ButtonProps} from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {CircularProgress} from "@mui/material";


export interface DropdownMenuItem {
    id: string;
    value: string;
}

interface DropdownButtonProps {
    buttonLabel: React.ReactNode;
    loading?: boolean;
    noItemsAvailable: string;
    disabled: boolean;
    onButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    menuItems: DropdownMenuItem[];
    onMenuItemClick?: (item: DropdownMenuItem) => void;
    sx?: ButtonProps['sx'];
}

export function DropdownButton ({
    buttonLabel,
    loading,
    noItemsAvailable,
    onButtonClick,
    menuItems,
    onMenuItemClick,
    disabled,
    sx
}: DropdownButtonProps) {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);

        if (onButtonClick) {
            onButtonClick(event);
        }
    };

    const handleMenuItemClick = (item: DropdownMenuItem) => {
        setAnchorEl(null);

        if (onMenuItemClick) {
            onMenuItemClick(item);
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const loadingItemElement = (
        <MenuItem disabled>
            <CircularProgress size={24} />
        </MenuItem>
    );
    const noItemsAvailableElement = (
        <MenuItem disabled>
            {noItemsAvailable}
        </MenuItem>
    );

    return (
        <div>
            <Button
                id="dropdown-button"
                disabled={disabled}
                aria-controls={open ? 'dropdown-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleButtonClick}
                variant="contained"
                size="large"
                sx={sx}
            >
                {buttonLabel}
            </Button>
            <Menu
                id="dropdown-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'dropdown-button',
                }}
            >
                {
                    loading ? loadingItemElement : (
                        menuItems.length === 0 ? noItemsAvailableElement : (
                            menuItems.map(item => (
                                <MenuItem
                                    key={item.id}
                                    onClick={() => handleMenuItemClick(item)}
                                >
                                    {item.value}
                                </MenuItem>
                            ))
                        )
                    )
                }
            </Menu>
        </div>
    );
}