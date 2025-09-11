/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Button, Dialog, DialogActions, DialogContent, DialogTitle, ThemeProvider} from "@mui/material";
import {darkTheme} from "../../utils";
import {PaperComponent} from "../PaperComponent";
import {ReactNode} from "react";

export interface BaseDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    actions?: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
    fullWidth?: boolean;
}

export function BaseDialog ({
    open,
    onClose,
    title,
    children,
    actions,
    maxWidth = "md",
    fullWidth = true
}: BaseDialogProps) {
    return (
        <ThemeProvider theme={darkTheme}>
            <Dialog
                open={open}
                onClose={onClose}
                PaperComponent={PaperComponent}
                aria-labelledby="draggable-dialog-title"
                maxWidth={maxWidth}
                fullWidth={fullWidth}
            >
                <DialogTitle style={{cursor: 'move'}} id="draggable-dialog-title">
                    {title}
                </DialogTitle>
                <DialogContent sx={{pt: '16px !important', pb: 0, pl: 0, pr: 0, m: 2}}>
                    {children}
                </DialogContent>
                <DialogActions>
                    {actions || (
                        <Button autoFocus onClick={onClose}>
                            Close
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
}