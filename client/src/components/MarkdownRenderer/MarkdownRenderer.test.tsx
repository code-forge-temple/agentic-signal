/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, describe, expect, it} from 'vitest';
import {MarkdownRenderer} from './MarkdownRenderer';

// The highlighter loads lazily: loaded once here, so each test waits for React alone.
beforeAll(async () => {
    await import('react-syntax-highlighter');
    await import('react-syntax-highlighter/dist/esm/styles/prism');
}, 30000);

// vitest runs without `globals`, so testing-library's automatic cleanup is never registered.
afterEach(() => {
    cleanup();
});

const BLOCK = 'Here it is:\n\n```json\n{"nodes": [], "edges": []}\n```\n';

/** The coloured block: a new block shows as plain text first, then gets its coloured tokens. */
async function highlightedBlock (container: HTMLElement): Promise<HTMLElement> {
    await waitFor(() => expect(container.querySelector('pre .token')).not.toBeNull(), {timeout: 5000});

    return container.querySelector('pre')!;
}

describe('MarkdownRenderer', () => {
    it('keeps a highlighted code block mounted when only its suffix callback changes', async () => {
        const {container, rerender} = render(<MarkdownRenderer content={BLOCK} disableLoadingDelay codeBlockSuffix={() => <span>first</span>} />);
        const block = await highlightedBlock(container);

        rerender(<MarkdownRenderer content={BLOCK} disableLoadingDelay codeBlockSuffix={() => <span>second</span>} />);

        expect(screen.queryByText('second')).not.toBeNull();
        expect(container.querySelector('pre')).toBe(block);
    });

    it('keeps a highlighted code block mounted when only its renderer callback changes', async () => {
        const {container, rerender} = render(<MarkdownRenderer content={BLOCK} disableLoadingDelay codeBlockRenderer={() => undefined} />);
        const block = await highlightedBlock(container);

        rerender(<MarkdownRenderer content={BLOCK} disableLoadingDelay codeBlockRenderer={() => undefined} />);

        expect(container.querySelector('pre')).toBe(block);
    });

    it('leaves a block longer than 20,000 characters uncoloured', async () => {
        const long = `\`\`\`json
${JSON.stringify(Array.from({length: 2000}, (_, id) => ({id, name: `item ${id}`})))}
\`\`\`
`;
        const {container} = render(<MarkdownRenderer content={long} disableLoadingDelay />);

        await waitFor(() => expect(container.querySelector('pre')).not.toBeNull());

        expect(container.querySelector('pre')!.textContent).toContain('"item 1999"');
        expect(container.querySelector('pre .token')).toBeNull();
    });

    it('draws a block with the newest renderer', async () => {
        const {container, rerender} = render(<MarkdownRenderer content={BLOCK} disableLoadingDelay codeBlockRenderer={() => undefined} />);

        await highlightedBlock(container);
        rerender(<MarkdownRenderer content={BLOCK} disableLoadingDelay codeBlockRenderer={() => <p>drawn instead</p>} />);

        expect(screen.queryByText('drawn instead')).not.toBeNull();
        expect(container.querySelector('pre')).toBeNull();
    });
});
