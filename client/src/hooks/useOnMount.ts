/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {useLatestValue} from "./useLatestValue";


/** Runs `onMount` once, when the component mounts, with the values of that first render. */
export function useOnMount (onMount: () => void) {
    const onMountRef = useLatestValue(onMount);

    useEffect(() => {
        onMountRef.current();
    }, [onMountRef]);
}
