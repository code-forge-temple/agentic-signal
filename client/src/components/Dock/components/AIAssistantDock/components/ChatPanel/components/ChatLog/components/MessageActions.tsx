/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {IconButton, Tooltip} from '@mui/material';
import {Trash} from 'iconoir-react';


type MessageActionsProps = {
    onDelete: () => void;
    deleteTooltip: string;
};

export const MessageActions = ({onDelete, deleteTooltip}: MessageActionsProps) => (
    <div className="chat-message-actions">
        <Tooltip title={deleteTooltip} placement="top" arrow>
            <IconButton size="small" className="chat-message-action-btn" onClick={onDelete}>
                <Trash width={13} height={13} />
            </IconButton>
        </Tooltip>
    </div>
);
