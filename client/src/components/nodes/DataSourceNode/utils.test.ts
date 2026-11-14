/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {buildDataSourceEnvelope, fileBase64, fileDataFromBytes, fileText, mimeTypeFromExtension} from './utils';
import {extractFileBlocksFromMarkdown, extractQueryFromMarkdown, withoutFileBlocks} from '@shared/utils';
import {FileData} from './types/workflow';

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

const encode = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe('fileDataFromBytes', () => {
    it('keeps a text file as a code block in its language', () => {
        expect(fileDataFromBytes({name: 'notes.txt', base64: encode('café\nline 2')})).toEqual({
            name: 'notes.txt', content: '```text\ncafé\nline 2\n```', base64: encode('café\nline 2'), mimeType: 'text/plain', isToolsPayload: false,
        });
    });

    it('keeps an image as a Markdown image, with the type it was sent with', () => {
        expect(fileDataFromBytes({name: 'pic.jpg', base64: 'AAAA', mimeType: 'image/jpeg'})).toMatchObject({
            content: '![pic.jpg](data:image/jpeg;base64,AAAA)', mimeType: 'image/jpeg', isToolsPayload: false,
        });
    });

    it('keeps a binary file as a placeholder for tools only, unless told otherwise', () => {
        expect(fileDataFromBytes({name: 'cv.pdf', base64: 'AAAA'})).toMatchObject({
            content: '[Binary attachment: cv.pdf]', mimeType: 'application/octet-stream', isToolsPayload: true,
        });
        expect(fileDataFromBytes({name: 'data.csv', base64: encode('a,b'), isToolsPayload: true}).isToolsPayload).toBe(true);
    });

    it('throws on base64 that isn\'t', () => {
        expect(() => fileDataFromBytes({name: 'cv.pdf', base64: 'not base64!'})).toThrow();
    });
});

describe('buildDataSourceEnvelope', () => {
    const json = (value: string) => ({type: 'json' as const, value});
    const markdown = (text: string, files: FileData[] = []) => ({type: 'markdown-and-files' as const, value: {text, files}});

    it('puts out its JSON, after an upstream object or before an upstream text', () => {
        expect(buildDataSourceEnvelope(json('{"a":1}'))).toEqual({payload: {a: 1}});
        expect(buildDataSourceEnvelope(json('{"a":1}'), {payload: {b: 2}})).toEqual({payload: [{b: 2}, {a: 1}]});
        expect(buildDataSourceEnvelope(json('{"a":1}'), {payload: 'up'})).toEqual({payload: [{a: 1}, 'up']});
    });

    it('passes upstream tools files on in JSON mode', () => {
        const tools = [{name: 'cv.pdf', base64: 'AAAA', mimeType: 'application/pdf'}];

        expect(buildDataSourceEnvelope(json('1'), {payload: 'up', toolsPayload: tools})).toEqual({payload: [1, 'up'], toolsPayload: tools});
    });

    it('says what is wrong with JSON that doesn\'t parse', () => {
        expect(() => buildDataSourceEnvelope(json('{oops'))).toThrow(/^Invalid JSON data: /);
    });

    it('adds text files and images to the text, and tools-only files to toolsPayload', () => {
        const files = [
            fileDataFromBytes({name: 'notes.txt', base64: encode('abc')}),
            fileDataFromBytes({name: 'pic.png', base64: 'AAAA'}),
            fileDataFromBytes({name: 'cv.pdf', base64: 'AAAA'}),
        ];

        expect(buildDataSourceEnvelope(markdown('hello', files))).toEqual({
            payload: 'hello\n\n### File name "notes.txt"\n```text\nabc\n```\n\n\n\n### Image 1 (file name pic.png) attached\n![pic.png](data:image/png;base64,AAAA)\n\n',
            toolsPayload: [{name: 'cv.pdf', base64: 'AAAA', mimeType: 'application/octet-stream'}],
        });
    });

    it('joins its text onto an upstream text, and follows anything else', () => {
        expect(buildDataSourceEnvelope(markdown(' and more'), {payload: 'up'})).toEqual({payload: 'up and more'});
        expect(buildDataSourceEnvelope(markdown('text'), {payload: {a: 1}})).toEqual({payload: [{a: 1}, 'text']});
    });

    it('refuses a tools-only file saved without its data', () => {
        expect(() => buildDataSourceEnvelope(markdown('', [{name: 'cv.pdf', content: '[Binary attachment: cv.pdf]'}])))
            .toThrow('No file data saved for "cv.pdf" — remove the file and attach it again.');
    });
});

describe('a Data Source message, as the RAG node and its LLM read it', () => {
    it('gives the RAG node each text file whole and the question, and leaves the LLM the question and the image', () => {
        const files = [
            fileDataFromBytes({name: 'guide.md', base64: encode(markdownWithCodeBlock)}),
            fileDataFromBytes({name: 'shot.png', base64: 'AAAA', mimeType: 'image/png'}),
            fileDataFromBytes({name: 'notes.txt', base64: encode('Plain notes.')}),
        ];
        const {payload} = buildDataSourceEnvelope({type: 'markdown-and-files', value: {text: 'What do the files say?', files}});
        const message = String(payload);

        expect(extractQueryFromMarkdown(message)).toBe('What do the files say?');
        // The Markdown file with a code block of its own gets a longer fence, so it stays one block; the saved one keeps three.
        expect(extractFileBlocksFromMarkdown(message)).toEqual([
            {name: 'guide.md', content: `\`\`\`\`markdown\n${markdownWithCodeBlock}\n\`\`\`\``},
            {name: 'notes.txt', content: '```text\nPlain notes.\n```'},
        ]);
        expect(fileText(files[0].content)).toBe(markdownWithCodeBlock);

        const forLlm = withoutFileBlocks(message);

        expect(forLlm).toContain('What do the files say?');
        expect(forLlm).toContain('![shot.png](data:image/png;base64,AAAA)');
        expect(forLlm).not.toContain('npm install');
        expect(forLlm).not.toContain('Plain notes.');
    });
});
