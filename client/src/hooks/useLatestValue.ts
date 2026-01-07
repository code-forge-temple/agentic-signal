/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useRef, useEffect} from "react";

/**
 * Returns a ref that always contains the latest value.
 * Useful for accessing current values in callbacks without stale closures.
 */
export function useLatestValue<T> (value: T) {
    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref;
}