/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {beforeEach, describe, expect, it, vi} from 'vitest';


// The store as a new start of the app makes it: loaded fresh, from what localStorage holds.
const freshStore = async () => {
    vi.resetModules();

    return (await import('./globalConfig')).useGlobalConfig;
};

beforeEach(() => localStorage.clear());

describe('useGlobalConfig', () => {
    it('starts with the values saved with persist, and only those', async () => {
        localStorage.setItem('agentic-signal.globalData.layerSwitcherExpanded', 'true');
        localStorage.setItem('unrelated', 'x');

        expect((await freshStore()).getState().globalData).toEqual({layerSwitcherExpanded: 'true'});
    });

    it('saves a value written with persist, removes it when emptied, and keeps one written without in memory only', async () => {
        const store = await freshStore();

        store.getState().setGlobalData('kept', 'yes', true);
        store.getState().setGlobalData('session', 'only', false);
        expect(localStorage.getItem('agentic-signal.globalData.kept')).toBe('yes');
        expect(localStorage.getItem('agentic-signal.globalData.session')).toBeNull();
        expect((await freshStore()).getState().globalData).toEqual({kept: 'yes'});

        store.getState().setGlobalData('kept', '', true);
        expect(localStorage.getItem('agentic-signal.globalData.kept')).toBeNull();
    });
});
