/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useRef, useState} from "react";

export function useAutoScroll () {
    const [autoScroll, setAutoScroll] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<Element | null>(null);
    const delay = 200;

    const performScroll = (chatDiv: Element | null) => {
        if (chatDiv) {
            chatDiv.scrollTop = chatDiv.scrollHeight;
        }
    };

    const updateScroll = useCallback(
        (chatDiv: Element | null) => {
            if (!chatDiv || !autoScroll) {
                return;
            }

            pendingRef.current = chatDiv;

            if (timerRef.current === null) {
                performScroll(chatDiv);

                timerRef.current = setTimeout(() => {
                    timerRef.current = null;

                    if (pendingRef.current) {
                        performScroll(pendingRef.current);

                        pendingRef.current = null;
                    }
                }, delay);
            }
        },
        [autoScroll]
    );

    const userInterruptAutoScroll = useCallback(
        (event: Event) => {
            const target = event.target as HTMLElement;
            const atBottom = Math.abs(target.scrollHeight - (target.scrollTop + target.clientHeight)) < 5;

            if (!atBottom) {
                setAutoScroll(false);
            }
        },
        []);

    return {updateScroll, setAutoScroll, userInterruptAutoScroll};
}