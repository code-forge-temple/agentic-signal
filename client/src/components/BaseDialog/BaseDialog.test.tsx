/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {BaseDialog} from './BaseDialog';


afterEach(cleanup);

describe('BaseDialog', () => {
    it('names each open dialog after its own title', () => {
        render(
            <>
                <BaseDialog open onClose={() => {}} title="Settings">settings</BaseDialog>
                <BaseDialog open onClose={() => {}} title="Logs">logs</BaseDialog>
            </>
        );

        // hidden: MUI hides the earlier dialog from screen readers when another opens.
        expect(screen.getByRole('dialog', {name: 'Settings', hidden: true}).textContent).toContain('settings');
        expect(screen.getByRole('dialog', {name: 'Logs', hidden: true}).textContent).toContain('logs');
    });
});
