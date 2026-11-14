/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import {Xmark, Expand, Collapse} from "iconoir-react";

type DialogTitleBarProps = {
    title: string;
    /** Shows the maximize/restore button. */
    maximizable: boolean;
    maximized: boolean;
    onToggleMaximized: () => void;
    onClose: () => void;
};

/** The dialog's title, which it's dragged by unless maximized, with its maximize and close buttons. */
export function DialogTitleBar ({title, maximizable, maximized, onToggleMaximized, onClose}: DialogTitleBarProps) {
    return (
        <DialogTitle
            style={{cursor: maximized ? 'default' : 'move', display: 'flex', alignItems: 'center', userSelect: 'none'}}
            id="draggable-dialog-title"
        >
            <span style={{flex: 1}}>{title}</span>
            {maximizable && (
                <Tooltip title={maximized ? "Restore" : "Maximize"}>
                    <IconButton size="medium" onClick={onToggleMaximized} sx={{mr: 0.5}}>
                        {maximized ? <Collapse width={24} height={24} /> : <Expand width={24} height={24} />}
                    </IconButton>
                </Tooltip>
            )}
            <Tooltip title="Close">
                <IconButton size="medium" onClick={onClose}>
                    <Xmark width={24} height={24} />
                </IconButton>
            </Tooltip>
        </DialogTitle>
    );
}
