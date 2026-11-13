/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
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
    /** More choices, shown between Cancel and the confirm button; each closes the dialog, as those two do. */
    extraActions?: {label: string; onClick: () => void}[];
    /** A set width in px, for more choices than the default width fits on one line. */
    width?: number;
    maximizable?: boolean;
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
    extraActions,
    width,
    maximizable,
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
            width={width}
            maximizable={maximizable}
            actions={
                <>
                    <Button onClick={handleCancel}>{cancelLabel}</Button>
                    {extraActions?.map(({label, onClick}) => (
                        <Button
                            key={label}
                            onClick={() => {
                                onClick();
                                onClose();
                            }}
                        >
                            {label}
                        </Button>
                    ))}
                    <Button variant="contained" onClick={handleConfirm}>{confirmLabel}</Button>
                </>
            }
        >
            <Typography>{message}</Typography>
        </BaseDialog>
    );
}
