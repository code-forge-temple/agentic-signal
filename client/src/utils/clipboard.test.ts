/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest';
import {copyText} from './clipboard';


describe('copyText', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('uses the clipboard API where the browser offers it', async () => {
        const writeText = vi.fn(() => Promise.resolve());

        vi.stubGlobal('navigator', {clipboard: {writeText}});

        await copyText('as_token');

        expect(writeText).toHaveBeenCalledWith('as_token');
    });

    it('otherwise copies from a hidden field beside what was clicked, then removes it and gives focus back', async () => {
        vi.stubGlobal('navigator', {});

        const dialog = document.createElement('div');
        const button = document.createElement('button');

        dialog.appendChild(button);
        document.body.appendChild(dialog);
        button.focus();

        let copied: {text: string; parent: Element | null} | null = null;

        document.execCommand = vi.fn(() => {
            const field = document.activeElement as HTMLTextAreaElement;

            copied = {text: field.value.slice(field.selectionStart, field.selectionEnd), parent: field.parentElement};

            return true;
        });

        await copyText('as_token');

        expect(copied).toEqual({text: 'as_token', parent: dialog});
        expect(dialog.querySelector('textarea')).toBeNull();
        expect(document.activeElement).toBe(button);
    });

    it('rejects when the browser won\'t copy', async () => {
        vi.stubGlobal('navigator', {});
        document.execCommand = vi.fn(() => false);

        await expect(copyText('as_token')).rejects.toThrow();
        expect(document.querySelector('textarea')).toBeNull();
    });
});
