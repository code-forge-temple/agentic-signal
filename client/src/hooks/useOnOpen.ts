/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {useLatestValue} from "./useLatestValue";


/** Runs `onOpen` each time `open` turns true (a settings dialog opening, say), with the values of that render. */
export function useOnOpen (open: boolean, onOpen: () => void) {
    const onOpenRef = useLatestValue(onOpen);

    useEffect(() => {
        if (open) onOpenRef.current();
    }, [open, onOpenRef]);
}
