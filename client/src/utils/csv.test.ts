/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {csvToMarkdownTable} from './csv';


describe('csvToMarkdownTable', () => {
    it('turns comma-separated rows into a table, trimming cells and escaping pipes', () => {
        expect(csvToMarkdownTable('name, size\n a.txt ,1\nb|c,2\r\n')).toBe('| name | size |\n| --- | --- |\n| a.txt | 1 |\n| b\\|c | 2 |');
    });

    it('reads quoted cells: commas inside, "" as one quote, text after the closing quote kept', () => {
        expect(csvToMarkdownTable('a,b\n"x, y","say ""hi"""\n"q"tail,"open')).toBe('| a | b |\n| --- | --- |\n| x, y | say "hi" |\n| qtail | open |');
    });

    it('is no table with fewer than two lines, an empty header, or rows of different lengths', () => {
        for (const text of ['', 'only,header', '\n\n a \n', 'a,b\n1', 'a,b\n1,2,3']) expect(csvToMarkdownTable(text), text).toBeNull();
    });
});
