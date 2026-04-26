/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ThemeProvider, Tooltip} from "@mui/material";
import {Xmark, Expand, Compress} from "iconoir-react";
import {darkTheme} from "../../utils";
import {PaperComponent} from "../PaperComponent";
import {ReactNode, useEffect, useState} from "react";

const BASE_Z = 1000;
const FOCUSED_Z = 1009;
const dialogSetters = new Set<(z: number) => void>();

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
    const [maximized, setMaximized] = useState(false);
    const [zIndex, setZIndex] = useState(BASE_Z);
    const isFocused = zIndex === FOCUSED_Z;

    useEffect(() => {
        dialogSetters.add(setZIndex);

        return () => { dialogSetters.delete(setZIndex); };
    }, []);

    useEffect(() => {
        if (!open) return;

        dialogSetters.forEach(setter => setter(BASE_Z));

        setZIndex(FOCUSED_Z);
    }, [open]);

    const handleFocus = () => {
        dialogSetters.forEach(setter => setter(BASE_Z));

        setZIndex(FOCUSED_Z);
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <Dialog
                open={open}
                onClose={(_event, reason) => {
                    if (reason === "backdropClick" || reason === "escapeKeyDown") return;

                    onClose();
                }}
                PaperComponent={PaperComponent}
                slotProps={{
                    root: {style: {zIndex, pointerEvents: "none"}},
                    paper: {
                        enableDragging: !maximized,
                        // eslint-disable-next-line max-len
                        cancel: "input, textarea, select, button, label, .MuiInputBase-root, .MuiSelect-root, .MuiButton-root, .MuiIconButton-root, [role='combobox'], .markdown-renderer, .ace_editor, .ace_text-input"
                    } as any
                }}
                aria-labelledby="draggable-dialog-title"
                maxWidth={maximized ? false : maxWidth}
                fullWidth={maximized ? false : fullWidth}
                fullScreen={maximized}
                hideBackdrop
                disableEnforceFocus
                disableEscapeKeyDown
                sx={{
                    "& .MuiPaper-root": {
                        pointerEvents: "auto",
                        backgroundColor: isFocused ? "#121212" : "#080808",
                        transition: "background-color 0.15s ease",
                        display: 'flex',
                        flexDirection: 'column',
                        height: maximized ? '100vh' : undefined,
                        minHeight: 0
                    }
                }}
            >
                <div onMouseDown={handleFocus} style={{display: "contents", height: '100%'}}>
                    <DialogTitle
                        style={{cursor: maximized ? 'default' : 'move', display: 'flex', alignItems: 'center'}}
                        id="draggable-dialog-title"
                    >
                        <span style={{flex: 1}}>{title}</span>
                        <Tooltip title={maximized ? "Restore" : "Maximize"}>
                            <IconButton size="medium" onClick={() => setMaximized(m => !m)} sx={{mr: 0.5}}>
                                {maximized ? <Compress width={24} height={24} /> : <Expand width={24} height={24} />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Close">
                            <IconButton size="medium" onClick={onClose}>
                                <Xmark width={24} height={24} />
                            </IconButton>
                        </Tooltip>
                    </DialogTitle>
                    <DialogContent sx={{
                        pt: '16px !important', pb: 0, pl: 0, pr: 0, m: 2,
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%'
                    }}>
                        {children}
                    </DialogContent>
                    <DialogActions>
                        {actions || (
                            <Button autoFocus onClick={onClose}>
                                Close
                            </Button>
                        )}
                    </DialogActions>
                </div>
            </Dialog>
        </ThemeProvider>
    );
}