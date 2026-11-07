/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest';
import {sha256} from './sha256';
import {sha256Hex} from '../services/commandConnections';


const hex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
const subtleHex = async (bytes: Uint8Array<ArrayBuffer>) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));

describe('sha256', () => {
    it('matches the standard test vectors', () => {
        expect(hex(sha256(new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect(hex(sha256(new Uint8Array()))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('matches the browser\'s own SHA-256 around the block boundaries, and on text that isn\'t ASCII', async () => {
        const texts = [55, 56, 63, 64, 65, 119, 120, 128, 1000].map(length => 'x'.repeat(length));

        texts.push('as_' + '0123456789abcdef'.repeat(3), 'Țară, € and 🙂');

        for (const text of texts) {
            const bytes = new TextEncoder().encode(text);

            expect(hex(sha256(bytes)), `${bytes.length} bytes`).toBe(await subtleHex(bytes));
        }
    });
});

describe('sha256Hex', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('gives the same hash on a page without crypto.subtle (plain http from another computer)', async () => {
        const token = 'as_' + 'ab12'.repeat(12);
        const expected = await sha256Hex(token);

        vi.stubGlobal('crypto', {getRandomValues: crypto.getRandomValues.bind(crypto)});

        expect(await sha256Hex(token)).toBe(expected);
    });
});
