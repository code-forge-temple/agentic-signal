/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import {ThemeProvider} from "@mui/material/styles";
import {darkTheme} from "../../utils";
import {PaperComponent, PaperComponentProps} from "../PaperComponent";
import {ReactNode, useContext, useId, useState} from "react";
import {DRAG_CANCEL_SELECTOR} from "../../constants";
import {WorkflowLayerContext} from "../../context/WorkflowLayerContext";
import {useDialogFocus} from "./useDialogFocus";
import {DialogTitleBar} from "./DialogTitleBar";
import {contentSx, dialogSize, dialogSx} from "./styles";

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
    const {zIndex, isFocused, handleFocus} = useDialogFocus(open);
    // Each dialog's own: with one id for all, every open dialog was named after the first one's title (and its buttons).
    const titleId = useId();

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
                aria-labelledby={titleId}
                {...dialogSize({maximized, width, maxWidth, fullWidth})}
                hideBackdrop
                disableEnforceFocus
                disableEscapeKeyDown
                sx={dialogSx({maximized, width, isFocused, isLayerActive})}
            >
                <div onMouseDown={handleFocus} style={{display: "contents", height: '100%'}}>
                    <DialogTitleBar
                        id={titleId}
                        title={title}
                        maximizable={maximizable}
                        maximized={maximized}
                        onToggleMaximized={() => setMaximized(m => !m)}
                        onClose={onClose}
                    />
                    <DialogContent sx={contentSx(compactTop)}>
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
