/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import * as React from 'react';
import Button, {ButtonProps} from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';


/** A button at the end of a menu item (delete, say): it does its own thing, without picking the item. */
export interface DropdownItemAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

export interface DropdownMenuItem {
    id: string;
    value: string;
    action?: DropdownItemAction;
}

// The menu closes first, so whatever the action opens (a confirm dialog) isn't behind it.
function ItemActionButton ({action, closeMenu}: {action: DropdownItemAction; closeMenu: () => void}) {
    return (
        <Tooltip title={action.label}>
            <IconButton
                size="small"
                edge="end"
                aria-label={action.label}
                onClick={(event) => {
                    event.stopPropagation();
                    closeMenu();
                    action.onClick();
                }}
                // Negative margins: a row with an action is as tall as one without.
                sx={{ml: 1, my: -1}}
            >
                {action.icon}
            </IconButton>
        </Tooltip>
    );
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
                                    sx={{justifyContent: "space-between"}}
                                >
                                    {item.value}
                                    {item.action && <ItemActionButton action={item.action} closeMenu={handleClose} />}
                                </MenuItem>
                            ))
                        )
                    )
                }
            </Menu>
        </div>
    );
}