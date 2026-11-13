/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import {ThemeProvider} from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import {Xmark, Expand, Collapse} from "iconoir-react";
import {darkTheme} from "../../utils";
import {PaperComponent, PaperComponentProps} from "../PaperComponent";
import {MouseEvent, ReactNode, useContext, useEffect, useState} from "react";
import {DRAG_CANCEL_SELECTOR} from "../../constants";
import {WorkflowLayerContext} from "../../context/WorkflowLayerContext";

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
    /** A set width in px instead of one that follows the content; it still shrinks to fit a small window. */
    width?: number;
    maximizable?: boolean;
    /** Content starts right under the title, without the usual gap: for content that opens with tabs. */
    compactTop?: boolean;
}

export function BaseDialog ({
    open,
    onClose,
    title,
    children,
    actions,
    maxWidth = "md",
    fullWidth = true,
    width,
    maximizable = true,
    compactTop = false
}: BaseDialogProps) {
    const {isActive: isLayerActive} = useContext(WorkflowLayerContext);
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

    const handleFocus = (event: MouseEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.target as Node)) return;

        dialogSetters.forEach(setter => setter(BASE_Z));

        setZIndex(FOCUSED_Z);
    };

    const paperProps: PaperComponentProps = {
        enableDragging: !maximized,
        cancel: DRAG_CANCEL_SELECTOR,
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
                    root: {style: {zIndex, pointerEvents: "none", visibility: isLayerActive ? undefined : "hidden"}},
                    paper: paperProps
                }}
                aria-labelledby="draggable-dialog-title"
                maxWidth={maximized || width ? false : maxWidth}
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
                        minHeight: 0,
                        ...(width && !maximized && {width, maxWidth: 'calc(100% - 64px)'})
                    },
                    ...(!isLayerActive && {
                        "& *": {visibility: "hidden !important", transition: "none !important"}
                    })
                }}
            >
                <div onMouseDown={handleFocus} style={{display: "contents", height: '100%'}}>
                    <DialogTitle
                        style={{cursor: maximized ? 'default' : 'move', display: 'flex', alignItems: 'center', userSelect: 'none'}}
                        id="draggable-dialog-title"
                    >
                        <span style={{flex: 1}}>{title}</span>
                        {maximizable && (
                            <Tooltip title={maximized ? "Restore" : "Maximize"}>
                                <IconButton size="medium" onClick={() => setMaximized(m => !m)} sx={{mr: 0.5}}>
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
                    <DialogContent
                        sx={{
                            pt: compactTop ? '0 !important' : '16px !important', pb: 0, pl: '10px', pr: '10px', m: 2,
                            ...(compactTop && {mt: 0}),
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%'
                        }}
                    >
                        {children}
                    </DialogContent>
                    <DialogActions sx={{pl: '16px', pr: '16px'}}>
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