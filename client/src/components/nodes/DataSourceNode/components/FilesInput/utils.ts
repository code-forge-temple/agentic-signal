/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/**
 * The tab to show once an attached file is gone (tab 0 is the text, tab n+1 the file at n): the text instead of the
 * removed file's tab, the same file one tab to the left when an earlier one went.
 */
export function tabAfterRemoval (tab: number, removed: number): number {
    if (tab > 0 && tab - 1 === removed) return 0;

    return tab > 0 && tab - 1 > removed ? tab - 1 : tab;
}
