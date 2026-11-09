/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useState} from 'react';
import {flushSync} from 'react-dom';


// Long enough for the browser to draw the overlay before the work holds the page up.
const OVERLAY_PAINT_DELAY_MS = 100;

/**
 * [isLoading, whileLoading]. `whileLoading(work, now)` shows the overlay at once, together with what `now` changes
 * (closing a question, say), and does the work a moment later, so a big workflow doesn't freeze the page before the
 * spinner shows.
 */
export function useLoadingOverlay () {
    const [isLoading, setIsLoading] = useState(false);

    const whileLoading = useCallback((work: () => void, now?: () => void) => {
        flushSync(() => {
            now?.();
            setIsLoading(true);
        });

        setTimeout(() => {
            try {
                work();
            } finally {
                setIsLoading(false);
            }
        }, OVERLAY_PAINT_DELAY_MS);
    }, []);

    return [isLoading, whileLoading] as const;
}
