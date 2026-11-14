/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {getEditorMode} from './utils';


describe('getEditorMode', () => {
    it('picks the editor mode by the extension, in any case', () => {
        const modes: Record<string, string> = {
            'a.md': 'markdown', 'a.txt': 'text', 'a.html': 'html', 'a.css': 'css', 'a.scss': 'scss', 'a.js': 'javascript',
            'a.ts': 'typescript', 'a.tsx': 'typescript', 'a.json': 'json', 'a.xml': 'xml', 'a.csv': 'csv', 'a.yaml': 'yaml',
            'a.yml': 'yaml', 'a.ini': 'ini', 'a.log': 'text', 'a.sh': 'sh', 'a.sql': 'sql', 'a.py': 'python', 'a.java': 'java',
            'a.c': 'c_cpp', 'a.cpp': 'c_cpp', 'a.h': 'c_cpp', 'a.bat': 'batchfile', 'a.env': 'ini', 'B.JSON': 'json', 'x.tar.PY': 'python',
        };

        for (const [name, mode] of Object.entries(modes)) expect(getEditorMode(name), name).toBe(mode);
    });

    it('shows images as Markdown, and anything else as text', () => {
        for (const name of ['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.bmp', 'a.webp', 'a.svg']) expect(getEditorMode(name), name).toBe('markdown');

        for (const name of ['a.rs', 'noext', '', 'a.', 'a.constructor', 'a.toString', 'a.__proto__']) expect(getEditorMode(name), name).toBe('text');
    });
});
