/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useRef} from "react";
import {useLatestValue} from "./useLatestValue";


/**
 * Runs `callback` once for each new timer trigger in the node's input. The callback is read at the trigger, so a node
 * may pass a new one on every render without the effect running again.
 */
export function useTimerTrigger (inputTimerTrigger: number | undefined, callback: () => void | Promise<void>) {
    const lastTriggerRef = useRef<number | undefined>(undefined);
    const callbackRef = useLatestValue(callback);

    useEffect(() => {
        if (inputTimerTrigger && inputTimerTrigger !== lastTriggerRef.current) {
            lastTriggerRef.current = inputTimerTrigger;

            void callbackRef.current();
        }
    }, [inputTimerTrigger, callbackRef]);
}
