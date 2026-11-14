/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, expectTypeOf, it} from 'vitest';
import {getField, withDefaults} from './utils';
import {
    extractFileBlocksFromMarkdown,
    extractQueryFromMarkdown,
    fileExtension,
    markdownFilePrefix,
    markdownImageFilePrefix,
    mayChangeRagCollection,
    ragOwnerKeyHash,
    weaviateAuthHeaders,
    withoutFileBlocks,
} from '@shared/utils';


describe('getField', () => {
    it('reads a key that has a value, from objects and arrays alike', () => {
        expect(getField({a: 0}, 'a', 9)).toBe(0);
        expect(getField({a: false}, 'a', true)).toBe(false);
        expect(getField({a: 'x'}, 'a', 'f')).toBe('x');
        expect(getField(['z'], '0', 'f')).toBe('z');
        expect(getField(Object.create({inherited: 'p'}), 'inherited', 'f')).toBe('p');
    });

    it('falls back for a missing, undefined, null or empty value, or a source that isn\'t an object', () => {
        for (const value of [undefined, null, '']) expect(getField({a: value}, 'a', 'f')).toBe('f');

        expect(getField({}, 'a', 'f')).toBe('f');

        for (const source of [null, undefined, 'abc', 3, true]) expect(getField(source, 'length', 'f')).toBe('f');
    });
});

describe('withDefaults', () => {
    it('fills in a default for each prop missing or undefined, and keeps the rest, falsy ones too', () => {
        const defaults = {size: 'm', count: 3, on: true};

        expect(withDefaults({}, defaults)).toEqual({size: 'm', count: 3, on: true});
        const props: {size?: string; count?: number; on?: boolean; extra?: null} = {size: undefined, count: 0, on: false, extra: null};

        expect(withDefaults(props, defaults)).toEqual({size: 'm', count: 0, on: false, extra: null});
        expect(withDefaults({size: '', count: 1}, defaults)).toEqual({size: '', count: 1, on: true});
    });

    it('types each defaulted prop as the props declare it, not as the literal type of its default', () => {
        const props: {mode?: 'json' | 'markdown'; on?: boolean; label?: string} = {};
        const filled = withDefaults(props, {mode: 'json', on: false} as const);

        expectTypeOf(filled.mode).toEqualTypeOf<'json' | 'markdown'>();
        expectTypeOf(filled.on).toEqualTypeOf<boolean>();
        expectTypeOf(filled.label).toEqualTypeOf<string | undefined>();
    });
});

describe('fileExtension', () => {
    it('is the last extension, lower-cased; empty for a name without one', () => {
        expect(fileExtension('a.B.PDF')).toBe('pdf');
        expect(fileExtension('.env')).toBe('env');

        for (const name of ['pdf', 'Makefile', 'trailing.', '']) expect(fileExtension(name), name).toBe('');
    });
});

describe('ragOwnerKeyHash', () => {
    it('is a fixed SHA-256 fingerprint of the key, never the key itself, and empty for no key', async () => {
        const key = '0b9c3f6e-7d1a-4a4e-9c55-2f1e8d3b6a10';
        const hash = await ragOwnerKeyHash(key);

        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toContain(key);
        expect(await ragOwnerKeyHash(key)).toBe(hash);
        expect(await ragOwnerKeyHash(`${key}x`)).not.toBe(hash);
        expect(await ragOwnerKeyHash('')).toBe('');
        expect(await ragOwnerKeyHash(undefined)).toBe('');
    });
});

describe('mayChangeRagCollection', () => {
    it('lets anyone change a collection without a key, and only the same key one with', async () => {
        const stored = await ragOwnerKeyHash('owner');

        expect(await mayChangeRagCollection(undefined, '')).toBe(true);
        expect(await mayChangeRagCollection('', 'anyone')).toBe(true);
        expect(await mayChangeRagCollection(null, undefined)).toBe(true);
        expect(await mayChangeRagCollection(stored, 'owner')).toBe(true);
        expect(await mayChangeRagCollection(stored, 'someone else')).toBe(false);
        expect(await mayChangeRagCollection(stored, '')).toBe(false);
        expect(await mayChangeRagCollection(stored, undefined)).toBe(false);
    });
});

describe('weaviateAuthHeaders', () => {
    it('sends a Weaviate API key as a bearer token, and nothing without one', () => {
        expect(weaviateAuthHeaders('wk')).toEqual({Authorization: 'Bearer wk'});
        expect(weaviateAuthHeaders('')).toEqual({});
        expect(weaviateAuthHeaders(undefined)).toEqual({});
    });

    it('drops the spaces around a pasted key, and takes a key of spaces for none', () => {
        expect(weaviateAuthHeaders(' wk\n')).toEqual({Authorization: 'Bearer wk'});
        expect(weaviateAuthHeaders('  ')).toEqual({});
    });
});

describe('attachments in a message (Data Source\'s file and image sections)', () => {
    const FENCE = '```';
    const guide = `# Guide\n\nIntro.\n\n### Setup\n\nRun it:\n\n${FENCE}bash\nnpm start\n${FENCE}\n\n### Usage\n\nUse it.`;
    const file = (name: string, text: string, lang = '') => `\n\n${markdownFilePrefix(name)}${FENCE}${lang}\n${text}\n${FENCE}\n\n`;
    const image = (index: number, name: string) => `\n\n${markdownImageFilePrefix(index, name)}![${name}](data:image/png;base64,AAAA)\n\n`;
    // The question with its own heading, two files around an image, and a message suffix after them.
    // eslint-disable-next-line max-len
    const message = `What does the guide say?\n\n### Context\n\nWe use it daily.${file('guide.md', guide, 'markdown')}${image(1, 'shot.png')}${file('notes.txt', 'Plain notes.')}Answer in French.`;

    it('takes a document whole, its own headings and code blocks included, and leaves images and later text out', () => {
        expect(extractFileBlocksFromMarkdown(message)).toEqual([
            {name: 'guide.md', content: `${FENCE}markdown\n${guide}\n${FENCE}`},
            {name: 'notes.txt', content: `${FENCE}\nPlain notes.\n${FENCE}`},
        ]);
    });

    it('takes the text before the first attachment as the query, its own headings included', () => {
        expect(extractQueryFromMarkdown(message)).toBe('What does the guide say?\n\n### Context\n\nWe use it daily.');
        expect(extractQueryFromMarkdown('Just a question.')).toBe('Just a question.');
    });

    it('knows an attachment whose name has quotes or parentheses in it', () => {
        const named = `Q?${image(1, 'photo (1).png')}${file('my "draft".md', 'Draft.')}`;

        expect(extractQueryFromMarkdown(named)).toBe('Q?');
        expect(extractFileBlocksFromMarkdown(named)).toEqual([{name: 'my "draft".md', content: `${FENCE}\nDraft.\n${FENCE}`}]);
        expect(withoutFileBlocks(named)).not.toContain('Draft.');
    });

    it('knows an attachment at the very start, as in a Slack message with files and no text', () => {
        // How the Slack Input node writes one: the sections joined by blank lines, nothing before the first.
        const slack = [`${markdownFilePrefix('x.json')}${FENCE}json\n{}\n${FENCE}`, `${markdownFilePrefix('notes.txt')}${FENCE}\nhi\n${FENCE}`].join('\n\n');

        expect(extractFileBlocksFromMarkdown(slack).map(file => file.name)).toEqual(['x.json', 'notes.txt']);
        expect(extractQueryFromMarkdown(slack)).toBe('');
        expect(withoutFileBlocks(slack).trim()).toBe('');
    });

    it('takes a placeholder line as the whole file, not what follows it', () => {
        expect(extractFileBlocksFromMarkdown(`q\n\n${markdownFilePrefix('doc.pdf')}[Binary attachment: doc.pdf]\n\nAnswer briefly.`))
            .toEqual([{name: 'doc.pdf', content: '[Binary attachment: doc.pdf]'}]);
    });

    it('leaves the text files out of the message, keeping the question, the images and what follows', () => {
        const kept = withoutFileBlocks(message);

        expect(kept).not.toContain('Intro.');
        expect(kept).not.toContain('Plain notes.');
        expect(kept).toContain('What does the guide say?\n\n### Context\n\nWe use it daily.');
        expect(kept).toContain('![shot.png](data:image/png;base64,AAAA)');
        expect(kept).toContain('Answer in French.');
        expect(withoutFileBlocks('No files here.')).toBe('No files here.');
    });
});
