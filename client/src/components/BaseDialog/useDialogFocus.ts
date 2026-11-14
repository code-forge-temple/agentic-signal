/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {MouseEvent, useEffect, useState} from "react";

const BASE_Z = 1000;
const FOCUSED_Z = 1009;
// Every open dialog's z-index setter: focusing one puts the others back.
const dialogSetters = new Set<(z: number) => void>();

const focusOnly = (setZIndex: (z: number) => void) => {
    dialogSetters.forEach(setter => setter(BASE_Z));
    setZIndex(FOCUSED_Z);
};

/** The dialog's place among the open dialogs: on top when it opens, and when clicked. */
export function useDialogFocus (open: boolean) {
    const [zIndex, setZIndex] = useState(BASE_Z);

    useEffect(() => {
        dialogSetters.add(setZIndex);

        return () => { dialogSetters.delete(setZIndex); };
    }, []);

    useEffect(() => {
        if (open) focusOnly(setZIndex);
    }, [open]);

    const handleFocus = (event: MouseEvent<HTMLElement>) => {
        if (event.currentTarget.contains(event.target as Node)) focusOnly(setZIndex);
    };

    return {zIndex, isFocused: zIndex === FOCUSED_Z, handleFocus};
}
