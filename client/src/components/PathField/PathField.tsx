/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactNode, useEffect, useRef, useState} from "react";
import {IconButton, InputAdornment, TextField, Tooltip} from "@mui/material";
import {Folder, Undo} from "iconoir-react";
import {useSnackbar} from "notistack";
import {isTauri} from "../../utils";
import {pickPathNatively} from "./nativePicker";
import {PathKind} from "./types";
import {errorMessage} from "@shared/utils";


const SAVE_DELAY_MS = 300;

type PathFieldProps = {
    label: string;
    kind: PathKind;
    /** Titles the desktop app's dialog, e.g. "Choose the workflows folder". */
    pickerTitle: string;
    /** The path in use, shown as is: one that was set, or the default. */
    value: string;
    /** A typed or chosen path; "" when the field is left empty. */
    onChange: (path: string) => void;
    helperText?: ReactNode;
    error?: boolean;
    /** A button back to the default path, while one is offered. */
    reset?: {label: string; onReset: () => void};
};

/*
 * A path the backend uses (the browser it runs, the folder it saves to), typed in; the desktop app
 * adds the system's own dialog to choose it. The browser gets no dialog: it never hands a page a
 * full path.
 */
export function PathField ({label, kind, pickerTitle, value, onChange, helperText, error, reset}: PathFieldProps) {
    const {enqueueSnackbar} = useSnackbar();
    const [draft, setDraft] = useState(value);
    const saveTimer = useRef<number | undefined>(undefined);
    const browseLabel = kind === "folder" ? "Choose a folder" : "Choose a file";

    // The path also changes from outside: chosen in the dialog, reset, or detected.
    useEffect(() => setDraft(value), [value]);

    useEffect(() => () => window.clearTimeout(saveTimer.current), []);

    const handleType = (text: string) => {
        setDraft(text);
        window.clearTimeout(saveTimer.current);

        // An emptied field waits for blur, so the default (or the detected browser) doesn't jump back in mid-typing.
        if (text.trim()) saveTimer.current = window.setTimeout(() => onChange(text), SAVE_DELAY_MS);
    };

    const handleBlur = () => {
        if (draft.trim()) return;

        // Shows the path in use again if leaving it empty changes nothing (the default was already in use).
        setDraft(value);
        onChange("");
    };

    const handleBrowse = () => {
        pickPathNatively({kind, title: pickerTitle, defaultPath: draft})
            .then((path) => {
                if (path) onChange(path);
            })
            .catch((err: unknown) => enqueueSnackbar(`Couldn't open the dialog: ${errorMessage(err)}`, {variant: "error"}));
    };

    const handleReset = () => {
        window.clearTimeout(saveTimer.current);
        reset?.onReset();
    };

    return (
        <TextField
            label={label}
            variant="outlined"
            fullWidth
            value={draft}
            onChange={(event) => handleType(event.target.value)}
            onBlur={handleBlur}
            helperText={helperText}
            error={error}
            slotProps={{
                // A long path is cut off in the field: hovering shows all of it.
                htmlInput: {title: draft},
                input: {
                    endAdornment: (reset || isTauri()) && (
                        <InputAdornment position="end">
                            {reset && (
                                <Tooltip title={reset.label}>
                                    <IconButton aria-label={reset.label} onClick={handleReset} edge={isTauri() ? false : "end"}>
                                        <Undo />
                                    </IconButton>
                                </Tooltip>
                            )}
                            {isTauri() && (
                                <Tooltip title={browseLabel}>
                                    <IconButton aria-label={browseLabel} onClick={handleBrowse} edge="end">
                                        <Folder />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </InputAdornment>
                    ),
                }
            }}
        />
    );
}
