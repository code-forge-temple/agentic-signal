/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Button, Typography} from "@mui/material";
import {BaseDialog} from "../BaseDialog";

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export function ConfirmDialog ({
    open,
    onClose,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const handleCancel = () => {
        onCancel?.();
        onClose();
    };

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <BaseDialog
            open={open}
            onClose={onClose}
            title={title}
            maxWidth="sm"
            fullWidth={false}
            actions={
                <>
                    <Button onClick={handleCancel}>{cancelLabel}</Button>
                    <Button variant="contained" onClick={handleConfirm}>{confirmLabel}</Button>
                </>
            }
        >
            <Typography>{message}</Typography>
        </BaseDialog>
    );
}
