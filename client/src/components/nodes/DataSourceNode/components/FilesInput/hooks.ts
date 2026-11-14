/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {RefObject, useEffect} from "react";
import {useLatestValue} from "../../../../../hooks/useLatestValue";
import {MarkdownAndFilesDataSource} from "../../types/workflow";

const REPORT_DELAY_MS = 300;

/** Hands on the text and files once they have stayed the same for a moment (on mount too). */
export function useDebouncedReport (
    text: string,
    files: NonNullable<MarkdownAndFilesDataSource["value"]>["files"],
    onChange: (value: MarkdownAndFilesDataSource["value"]) => void
) {
    // The newest callback, read when the time comes: a new one alone doesn't restart the wait.
    const onChangeRef = useLatestValue(onChange);

    useEffect(() => {
        const timeout = window.setTimeout(() => onChangeRef.current({text, files}), REPORT_DELAY_MS);

        return () => clearTimeout(timeout);
    }, [text, files, onChangeRef]);
}

/** Lets the mouse wheel scroll the tabs sideways. */
export function useWheelScrollsTabs (tabsRef: RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const scroller = tabsRef.current?.querySelector('.MuiTabs-scroller') as HTMLDivElement | null | undefined;

        if (!scroller) return;

        const onWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();

                scroller.scrollLeft += e.deltaY;
            }
        };

        scroller.addEventListener('wheel', onWheel, {passive: false});

        return () => scroller.removeEventListener('wheel', onWheel);
    }, [tabsRef]);
}
