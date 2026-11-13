/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {RagSettings} from './RagSettings';
import {defaultRagNodeData} from '../types/workflow';


type Props = Parameters<typeof RagSettings>[0];

const collections = {
    availableCollections: [],
    loadingCollections: false,
    isEmbeddingModelLocked: false,
    isEmbeddingModelLockedRef: {current: false},
    checkCollectionLockByName: vi.fn(async () => {}),
    selectCollection: vi.fn(async () => {}),
    fetchCollections: vi.fn(async () => {}),
} as unknown as Props['collections'];

const field = (name: string) => screen.getByRole<HTMLInputElement>('spinbutton', {name});

// Types into the field and waits out its debounce.
const type = (name: string, text: string) => {
    fireEvent.change(field(name), {target: {value: text}});
    act(() => {
        vi.advanceTimersByTime(300);
    });
};

function renderSettings (change: Props['change']) {
    render(
        <RagSettings
            open
            onClose={vi.fn()}
            title="RAG"
            data={{...defaultRagNodeData, embeddingModel: 'nomic-embed-text'}}
            change={change}
            apiKey=""
            setApiKey={vi.fn()}
            models={['nomic-embed-text']}
            isFetchingModels={false}
            collections={collections}
            onPickCollection={vi.fn()}
        />
    );
}

describe('RagSettings numbers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('saves nothing for a cleared number, where it used to save NaN', () => {
        const change = vi.fn();

        renderSettings(change);
        type('Chunk Size (words)', '');
        type('Chunk Overlap (words)', '');
        type('Top-K Results', '');

        expect(change).not.toHaveBeenCalled();
    });

    it('keeps a typed number within its range', () => {
        const change = vi.fn();

        renderSettings(change);
        type('Chunk Size (words)', '5000');
        expect(change).toHaveBeenLastCalledWith({chunkSize: 2048});
        type('Chunk Overlap (words)', '300');
        expect(change).toHaveBeenLastCalledWith({chunkOverlap: 256});
        type('Top-K Results', '0');
        expect(change).toHaveBeenLastCalledWith({topK: 1});
    });

    it('shows the number it saved', () => {
        renderSettings(vi.fn());
        type('Chunk Size (words)', '5000');

        expect(field('Chunk Size (words)').value).toBe('2048');
    });
});
