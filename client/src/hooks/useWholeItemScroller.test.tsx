/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useWholeItemScroller} from './useWholeItemScroller';

const ITEM_WIDTH = 40;
const GAP = 8;
const STRIDE = ITEM_WIDTH + GAP;
const ITEM_COUNT = 19;
/* What the row measures when laid out: the items plus the gaps between them. */
const CONTENT_WIDTH = ITEM_COUNT * STRIDE - GAP;

/* jsdom performs no layout, so every measurement the hook takes has to be stated outright. */
const define = (element: Element, values: Record<string, number>) => {
    Object.entries(values).forEach(([name, value]) => {
        Object.defineProperty(element, name, {value, configurable: true, writable: true});
    });
};

const defineRect = (element: Element, {left = 0, width}: {left?: number; width: number}) => {
    element.getBoundingClientRect = () => ({
        left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}),
    });
};

/* jsdom ships no ResizeObserver; this stub lets a test fire the resize the hook listens for. */
const resizeCallbacks: ResizeObserverCallback[] = [];

class ResizeObserverStub implements ResizeObserver {
    constructor (callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
    }

    observe () { /* the stub fires on demand, not on layout */ }

    unobserve () { /* empty */ }

    disconnect () { /* empty */ }
}

const Harness = () => {
    const {viewportRef, canScrollLeft, canScrollRight, isScrollable, scrollByPage} = useWholeItemScroller<HTMLDivElement>();

    return (
        <>
            <div data-testid="viewport" ref={viewportRef}>
                <div data-testid="row">
                    {Array.from({length: ITEM_COUNT}, (_, index) => <div key={index} data-testid="item" />)}
                </div>
            </div>
            <span data-testid="state">{`${isScrollable}/${canScrollLeft}/${canScrollRight}`}</span>
            <button type="button" onClick={() => scrollByPage(-1)}>prev</button>
            <button type="button" onClick={() => scrollByPage(1)}>next</button>
        </>
    );
};

/**
 * @param available room the flex layout offers the viewport
 * @param scrollLeft where the strip is scrolled to
 */
const setup = ({available, scrollLeft = 0, itemWidth = ITEM_WIDTH, stride = STRIDE}: {
    available: number;
    scrollLeft?: number;
    itemWidth?: number;
    stride?: number;
}) => {
    render(<Harness />);

    const viewport = screen.getByTestId('viewport');
    const scrollBy = vi.fn();
    const contentWidth = ITEM_COUNT * stride - (stride - itemWidth);

    viewport.scrollBy = scrollBy;

    define(viewport, {scrollWidth: contentWidth, scrollLeft});

    /* Mirrors the real element: it reports the room on offer while the hook has released
     * its width, and the trimmed width once the hook has applied one. */
    const usedWidth = () => viewport.style.width ? parseFloat(viewport.style.width) : available;

    Object.defineProperty(viewport, 'clientWidth', {configurable: true, get: usedWidth});

    viewport.getBoundingClientRect = () => ({
        left: 0, width: usedWidth(), right: usedWidth(), top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}),
    });

    defineRect(screen.getByTestId('row'), {width: contentWidth});

    screen.getAllByTestId('item').forEach((item, index) => {
        defineRect(item, {left: index * stride, width: itemWidth});
    });

    /* The hook trims the viewport on mount, before these measurements existed - fire the
     * observer so it re-measures, exactly as a real layout change would. */
    act(() => {
        resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
    });

    return {viewport, scrollBy};
};

const state = () => screen.getByTestId('state').textContent;

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    /* Run the hook's rAF-throttled re-fit straight away. */
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callback(0);

        return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', () => { /* nothing queued to cancel */ });
});

afterEach(() => {
    /* vitest runs without `globals`, so testing-library's automatic cleanup is never registered. */
    cleanup();

    resizeCallbacks.length = 0;
    vi.unstubAllGlobals();
});

describe('useWholeItemScroller', () => {
    it('trims the viewport to whole items, never cutting one in half', () => {
        /* 300px holds six items and 12px of a seventh; that seventh must not show. */
        const {viewport} = setup({available: 300});

        expect(viewport.style.width).toBe(`${6 * STRIDE - GAP}px`);
    });

    it('leaves no trailing gap when the trim lands on an exact fit', () => {
        const {viewport} = setup({available: 4 * STRIDE - GAP});

        expect(viewport.style.width).toBe(`${4 * STRIDE - GAP}px`);
    });

    it('stops at the content width when there is room to spare', () => {
        const {viewport} = setup({available: 2000});

        expect(viewport.style.width).toBe(`${CONTENT_WIDTH}px`);
        expect(state()).toBe('false/false/false');
    });

    it('keeps one item on show even when the room offered is less than that', () => {
        const {viewport} = setup({available: 20});

        expect(viewport.style.width).toBe(`${ITEM_WIDTH}px`);
    });

    it('pages by exactly the number of items on show', () => {
        const {scrollBy} = setup({available: 300});

        act(() => { screen.getByText('next').click(); });

        expect(scrollBy).toHaveBeenCalledWith({left: 6 * STRIDE, behavior: 'smooth'});

        act(() => { screen.getByText('prev').click(); });

        expect(scrollBy).toHaveBeenLastCalledWith({left: -6 * STRIDE, behavior: 'smooth'});
    });

    it('leaves the far end of the strip on an item boundary', () => {
        /* The trimmed width and the content width both end on a boundary, so what is left
         * to scroll is a whole number of items - the clamped last page cannot cut one. */
        const {viewport} = setup({available: 300});
        const maxScrollLeft = CONTENT_WIDTH - parseFloat(viewport.style.width);

        expect(maxScrollLeft % STRIDE).toBe(0);
    });

    it('reports only a forward page while parked at the start', () => {
        setup({available: 300});

        expect(state()).toBe('true/false/true');
    });

    it('reports both directions once scrolled into the middle', () => {
        const {viewport} = setup({available: 300, scrollLeft: 6 * STRIDE});

        act(() => { viewport.dispatchEvent(new Event('scroll')); });

        expect(state()).toBe('true/true/true');
    });

    it('reports no forward page at the far end, ignoring sub-pixel slack', () => {
        const {viewport} = setup({available: 300});

        define(viewport, {scrollLeft: CONTENT_WIDTH - parseFloat(viewport.style.width) - 0.4});

        act(() => { viewport.dispatchEvent(new Event('scroll')); });

        expect(state()).toBe('true/true/false');
    });

    it('keeps an item that fits by a hair when zoom makes the stride fractional', () => {
        /* A device-pixel-snapped stride of 47.9986: six of them plus the gap is 287.99, so
         * flooring the raw ratio would show five items and leave a wide empty strip. */
        const stride = 47.9986;
        const {viewport} = setup({available: 6 * stride - (stride - ITEM_WIDTH), itemWidth: ITEM_WIDTH, stride});

        expect(parseFloat(viewport.style.width)).toBeCloseTo(6 * stride - (stride - ITEM_WIDTH), 3);
    });

    it('pages by the fractional stride rather than a rounded one', () => {
        /* Rounding 47.9986 up to 48 would drift a pixel per page and cut an icon a few pages in. */
        const stride = 47.9986;
        const {scrollBy} = setup({available: 300, stride});

        act(() => { screen.getByText('next').click(); });

        expect(scrollBy.mock.calls[0][0].left).toBeCloseTo(6 * stride, 3);
    });
});
