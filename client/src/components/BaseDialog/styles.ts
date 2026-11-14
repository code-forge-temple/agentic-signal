/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {SxProps, Theme} from "@mui/material/styles";

type DialogLook = {maximized: boolean; width?: number; isFocused: boolean; isLayerActive: boolean};

/** MUI's sizing props: a maximized dialog fills the screen, a set width replaces the max width. */
export const dialogSize = ({maximized, width, maxWidth, fullWidth}: {maximized: boolean; width?: number; maxWidth: 'sm' | 'md' | 'lg' | 'xl'; fullWidth: boolean}) => ({
    maxWidth: maximized || width ? false as const : maxWidth,
    fullWidth: maximized ? false : fullWidth,
    fullScreen: maximized,
});

/** The dialog's look: brighter when focused, full height when maximized, and hidden with a layer that isn't shown. */
export const dialogSx = ({maximized, width, isFocused, isLayerActive}: DialogLook): SxProps<Theme> => ({
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
});

/** The content's padding: without the usual gap under the title for content that opens with tabs. */
export const contentSx = (compactTop: boolean): SxProps<Theme> => ({
    pt: compactTop ? '0 !important' : '16px !important', pb: 0, pl: '10px', pr: '10px', m: 2,
    ...(compactTop && {mt: 0}),
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
});
