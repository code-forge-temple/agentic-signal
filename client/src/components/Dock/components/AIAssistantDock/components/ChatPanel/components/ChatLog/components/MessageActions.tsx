/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {IconButton, Tooltip} from '@mui/material';
import {Trash, Undo} from 'iconoir-react';


type MessageActionsProps = {
    onDelete: () => void;
    deleteTooltip: string;
    onResend?: () => void;
    resendDisabled?: boolean;
};

export const MessageActions = ({onDelete, deleteTooltip, onResend, resendDisabled = false}: MessageActionsProps) => (
    <div className="chat-message-actions">
        <Tooltip title={deleteTooltip} placement="top" arrow>
            <IconButton size="small" className="chat-message-action-btn" onClick={onDelete}>
                <Trash width={13} height={13} />
            </IconButton>
        </Tooltip>
        {onResend && (
            <Tooltip title="Rewind & resend message" placement="bottom" arrow>
                {/* A disabled button gets no mouse events, so the tooltip listens on the span around it. */}
                <span>
                    <IconButton
                        size="small"
                        className="chat-message-action-btn resend"
                        aria-label="Rewind & resend message"
                        onClick={onResend}
                        disabled={resendDisabled}
                    >
                        <Undo width={13} height={13} />
                    </IconButton>
                </span>
            </Tooltip>
        )}
    </div>
);
