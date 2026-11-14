/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {tabAfterRemoval} from './utils';


describe('tabAfterRemoval', () => {
    it('shows the text instead of the removed file\'s tab, and keeps a later file shown one tab to the left', () => {
        expect(tabAfterRemoval(2, 1)).toBe(0);
        expect(tabAfterRemoval(3, 0)).toBe(2);
        expect(tabAfterRemoval(1, 3)).toBe(1);
        expect(tabAfterRemoval(0, 0)).toBe(0);
    });
});

