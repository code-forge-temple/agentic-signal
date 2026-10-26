/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {fileBase64, fileText, mimeTypeFromExtension} from './utils';

const decode = (base64: string) => new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
const markdownWithCodeBlock = '# Setup\n\n```bash\nnpm install\n```\n\nThen read the rest.';

describe('mimeTypeFromExtension', () => {
    it.each([
        ['csv', 'text/csv'],
        ['md', 'text/plain'],
        ['png', 'image/png'],
        ['jpg', 'image/jpeg'],
        ['svg', 'image/svg+xml'],
        ['pdf', 'application/octet-stream'],
    ])('%s -> %s', (ext, mimeType) => {
        expect(mimeTypeFromExtension(ext)).toBe(mimeType);
    });
});

describe('fileText', () => {
    it('keeps a file\'s own code blocks instead of stopping at the first fence', () => {
        expect(fileText(`\`\`\`markdown\n${markdownWithCodeBlock}\n\`\`\``)).toBe(markdownWithCodeBlock);
    });

    it('returns an empty file as an empty string', () => {
        expect(fileText('```text\n\n```')).toBe('');
    });

    it('is undefined for content that isn\'t a code block', () => {
        expect(fileText('hello')).toBeUndefined();
    });
});

describe('fileBase64', () => {
    it('returns the saved base64 as is', () => {
        expect(fileBase64({name: 'cv.pdf', content: '[Binary attachment: cv.pdf]', base64: 'JVBERi0='}, 'pdf')).toBe('JVBERi0=');
    });

    it('rebuilds a text file from its code block, keeping UTF-8 and CRLF line endings', () => {
        const base64 = fileBase64({name: 'data.csv', content: '```csv\nname,city\r\nZoë,Köln\r\n\n```'}, 'csv');

        expect(base64 && decode(base64)).toBe('name,city\r\nZoë,Köln\r\n');
    });

    it('rebuilds a Markdown file with code blocks of its own in full', () => {
        const base64 = fileBase64({name: 'setup.md', content: `\`\`\`markdown\n${markdownWithCodeBlock}\n\`\`\``}, 'md');

        expect(base64 && decode(base64)).toBe(markdownWithCodeBlock);
    });

    it('takes a text file without a code block as plain text', () => {
        const base64 = fileBase64({name: 'notes.txt', content: 'hello'}, 'txt');

        expect(base64 && decode(base64)).toBe('hello');
    });

    it('rebuilds an image from its data URL', () => {
        expect(fileBase64({name: 'a.png', content: '![a.png](data:image/png;base64,iVBORw0KGgo=)'}, 'png')).toBe('iVBORw0KGgo=');
    });

    it('cannot rebuild a binary file from its placeholder', () => {
        expect(fileBase64({name: 'cv.pdf', content: '[Binary attachment: cv.pdf]'}, 'pdf')).toBeUndefined();
    });
});
