/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LayerSwitcher} from './LayerSwitcher';
import {LayersProvider} from '../../../../context/LayersContext';
import {useGlobalConfig} from '../../../../stores/globalConfig';

// The app's build turns the SVG into a component (svgr); the tests load it as a URL.
vi.mock('./assets/layer.svg', () => ({default: () => null}));


const STORAGE_KEY = 'agentic-signal.globalData.layerSwitcherExpanded';

const toggle = () => screen.getByRole('button', {name: /^(Show|Hide) layers$/});

const renderSwitcher = () => render(<LayersProvider><LayerSwitcher /></LayersProvider>);

beforeEach(() => {
    localStorage.clear();
    useGlobalConfig.setState({globalData: {}});
});

afterEach(cleanup);

describe('LayerSwitcher', () => {
    it('starts hidden, and keeps the layers shown or hidden as left, saved for the next start', () => {
        renderSwitcher();
        expect(toggle().getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(toggle());
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

        // Mounted again, it reads the saved value (at a new start the store loads it from storage: globalConfig.test.ts).
        cleanup();
        renderSwitcher();
        expect(toggle().getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(toggle());
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});
