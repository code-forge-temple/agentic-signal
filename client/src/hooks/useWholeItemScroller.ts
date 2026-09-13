/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";

/** Sub-pixel slack, so fractional layout widths do not report a permanent 1px-worth of hidden content. */
const SCROLL_EPSILON = 1;
/** Absorbs the rounding error in a fractional stride, which would otherwise drop an item that does fit. */
const FIT_EPSILON = 0.01;

type ScrollState = {
    canScrollLeft: boolean;
    canScrollRight: boolean;
};

const INITIAL_SCROLL_STATE: ScrollState = {canScrollLeft: false, canScrollRight: false};

/**
 * Horizontal scroller for a strip of equally sized items that never shows a partial one:
 * the viewport is trimmed to a whole number of items, and it pages by that same number.
 *
 * Because the trimmed width and the content width both end on an item boundary, the
 * clamped scroll position at the far end lands on one too - no half item at either edge.
 *
 * The scrolled element must hold a single child row sized to its content (`width: max-content`),
 * whose children are the items.
 */
export function useWholeItemScroller<T extends HTMLElement> () {
    const viewportRef = useRef<T | null>(null);
    const strideRef = useRef(0);
    const visibleCountRef = useRef(1);
    const frameRef = useRef<number | null>(null);
    const [{canScrollLeft, canScrollRight}, setScrollState] = useState<ScrollState>(INITIAL_SCROLL_STATE);

    const isScrollable = canScrollLeft || canScrollRight;

    const syncScrollState = useCallback(() => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
        const next: ScrollState = {
            canScrollLeft: viewport.scrollLeft > SCROLL_EPSILON,
            canScrollRight: viewport.scrollLeft < maxScrollLeft - SCROLL_EPSILON,
        };

        setScrollState((prev) => prev.canScrollLeft === next.canScrollLeft && prev.canScrollRight === next.canScrollRight ? prev : next);
    }, []);

    const fitWholeItems = useCallback(() => {
        const viewport = viewportRef.current;
        const row = viewport?.firstElementChild as HTMLElement | null;
        const items = row?.children;

        if (!viewport || !row || !items?.length) {
            return;
        }

        /* Rects rather than offsetWidth/offsetLeft: those round to whole pixels, which stops
         * matching real layout as soon as a dock dimension is set in anything but px. */
        const first = items[0].getBoundingClientRect();
        const itemWidth = first.width;
        /* Measured rather than assumed, so the gap stays a style decision. */
        const stride = items.length > 1 ? items[1].getBoundingClientRect().left - first.left : itemWidth;

        if (stride <= 0) {
            return;
        }

        const gap = stride - itemWidth;

        /* Drop the width we imposed last time, so the flex layout reports the room actually
         * on offer, then take back only a whole number of items of it. */
        viewport.style.width = "";

        const available = viewport.getBoundingClientRect().width;
        const visibleCount = Math.max(1, Math.floor((available + gap) / stride + FIT_EPSILON));
        const width = Math.min(row.getBoundingClientRect().width, visibleCount * stride - gap);

        viewport.style.width = `${width}px`;

        strideRef.current = stride;
        visibleCountRef.current = visibleCount;

        syncScrollState();
    }, [syncScrollState]);

    const scheduleFit = useCallback(() => {
        if (frameRef.current !== null) {
            return;
        }

        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;

            fitWholeItems();
        });
    }, [fitWholeItems]);

    useEffect(() => {
        const viewport = viewportRef.current;
        const row = viewport?.firstElementChild;

        if (!viewport || !row) {
            return;
        }

        viewport.addEventListener("scroll", syncScrollState, {passive: true});
        window.addEventListener("resize", scheduleFit);

        /* The row is sized to its own content, so this reports a change in the items
         * themselves - never an echo of the width this hook just set on the viewport. */
        const observer = new ResizeObserver(scheduleFit);

        observer.observe(row);

        return () => {
            viewport.removeEventListener("scroll", syncScrollState);
            window.removeEventListener("resize", scheduleFit);
            observer.disconnect();

            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);

                frameRef.current = null;
            }
        };
    }, [scheduleFit, syncScrollState]);

    /* Re-fit once the pagers come or go: they take room from the same row, so the count
     * of items that fit changes with them. Settles in one extra pass - dropping the pagers
     * only ever frees space, and "everything fits" is where that ends. */
    useLayoutEffect(() => {
        fitWholeItems();
    }, [fitWholeItems, isScrollable]);

    const scrollByPage = useCallback((direction: -1 | 1) => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        viewport.scrollBy({left: direction * visibleCountRef.current * strideRef.current, behavior: "smooth"});
    }, []);

    return {
        viewportRef,
        canScrollLeft,
        canScrollRight,
        isScrollable,
        scrollByPage,
    };
}
