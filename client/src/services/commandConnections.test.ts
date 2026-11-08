/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest';
import {newCommandToken, parseCommandConnections, parseCommandList, sha256Hex} from './commandConnections';


describe('parseCommandConnections', () => {
    it('keeps well-formed connections and drops the rest', () => {
        const good = {id: '1', name: 'Scribe Pal', token: 'as_x', commands: []};

        expect(parseCommandConnections(JSON.stringify([good, {id: '2', name: 'no token'}, 'junk']))).toEqual([good]);
    });

    it('returns none for nothing stored or something unreadable', () => {
        expect(parseCommandConnections(undefined)).toEqual([]);
        expect(parseCommandConnections('{oops')).toEqual([]);
        expect(parseCommandConnections('{"not":"a list"}')).toEqual([]);
    });
});

describe('parseCommandList', () => {
    it('reads commands separated by commas or spaces, as command names', () => {
        expect(parseCommandList('research, /Daily-Report  echo')).toEqual(['research', 'daily-report', 'echo']);
    });

    it('drops duplicates and names that aren\'t commands', () => {
        expect(parseCommandList('echo, echo, two_words, ')).toEqual(['echo']);
        expect(parseCommandList('')).toEqual([]);
    });
});

describe('newCommandToken', () => {
    it('makes a different 48-digit token each time', () => {
        const a = newCommandToken();

        expect(a).toMatch(/^as_[0-9a-f]{48}$/);
        expect(newCommandToken()).not.toBe(a);
    });
});

describe('sha256Hex', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('hashes like the backend does', async () => {
        expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('gives the same hashes on a page without crypto.subtle (plain http from another computer)', async () => {
        const texts = ['', 'as_' + 'ab12'.repeat(12), 'x'.repeat(55), 'x'.repeat(64), 'Zoë, € and 🙂'];
        const expected = await Promise.all(texts.map(sha256Hex));

        vi.stubGlobal('crypto', {getRandomValues: crypto.getRandomValues.bind(crypto)});

        expect(await Promise.all(texts.map(sha256Hex))).toEqual(expected);
    });
});
