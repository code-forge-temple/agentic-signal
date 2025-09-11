/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useRef} from "react";

export function useTimerTrigger (inputTimerTrigger: number | undefined, callback: () => void) {
    const lastTriggerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (inputTimerTrigger && inputTimerTrigger !== lastTriggerRef.current) {
            lastTriggerRef.current = inputTimerTrigger;

            callback();
        }
    }, [inputTimerTrigger, callback]);
}