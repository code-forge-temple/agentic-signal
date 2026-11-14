/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
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
    deleteCollection: vi.fn(async () => null),
} as unknown as Props['collections'];

const field = (name: string) => screen.getByRole<HTMLInputElement>('spinbutton', {name});

// Types into the field and waits out its debounce.
const type = (name: string, text: string) => {
    fireEvent.change(field(name), {target: {value: text}});
    act(() => {
        vi.advanceTimersByTime(300);
    });
};

function renderSettings (change: Props["change"], overrides: Partial<Props> = {}) {
    return render(
        <RagSettings
            open
            onClose={vi.fn()}
            title="RAG"
            data={{...defaultRagNodeData, embeddingModel: 'nomic-embed-text'}}
            change={change}
            apiKey=""
            setApiKey={vi.fn()}
            ownerKey=""
            setOwnerKey={vi.fn()}
            models={['nomic-embed-text']}
            isFetchingModels={false}
            collections={collections}
            onPickCollection={vi.fn()}
            {...overrides}
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

describe('RagSettings owner key', () => {
    afterEach(() => {
        cleanup();
    });

    it('offers a generate button while the key is empty, which sets a fresh UUID', () => {
        const setOwnerKey = vi.fn();

        renderSettings(vi.fn(), {setOwnerKey});
        fireEvent.click(screen.getByRole('button', {name: 'Generate a key'}));

        expect(setOwnerKey).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
    });

    it('has no generate button once there is a key: a new one would lock the node out of its collections', () => {
        renderSettings(vi.fn(), {ownerKey: 'k1'});

        expect(screen.getByRole<HTMLInputElement>('textbox', {name: 'Owner Key (optional)'}).value).toBe('k1');
        expect(screen.queryByRole('button', {name: 'Generate a key'})).toBeNull();
    });
});

describe('RagSettings deleting a collection', () => {
    afterEach(() => {
        cleanup();
    });

    function withCollections (...availableCollections: {id: string; value: string; owned: boolean; deletable: boolean}[]) {
        return withCollectionsDeleting(null, ...availableCollections);
    }

    // `outcome`: what the delete resolves to, null when it worked, else why it failed.
    function withCollectionsDeleting (outcome: string | null, ...availableCollections: {id: string; value: string; owned: boolean; deletable: boolean}[]) {
        const deleteCollection = vi.fn(async (): Promise<string | null> => outcome);
        const onPickCollection = vi.fn();

        renderSettings(vi.fn(), {collections: {...collections, availableCollections, deleteCollection}, onPickCollection});
        // The dialog is in a portal, outside the render's container.
        fireEvent.click(document.getElementById('dropdown-button')!);

        return {deleteCollection, onPickCollection};
    }

    it('shows a bin only on the collections the node may delete, and deletes one after the confirmation', () => {
        const docs = {id: 'Docs', value: 'docs', owned: true, deletable: true};
        const {deleteCollection, onPickCollection} = withCollections(docs, {id: 'Other', value: 'other', owned: true, deletable: false});

        expect(screen.queryByRole('button', {name: 'Delete "other"'})).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'Delete "docs"'}));

        // By its title's text: every BaseDialog is labelled by the same id, so its name is the first open dialog's.
        const dialog = screen.getByText('Delete the Collection').closest<HTMLElement>('[role="dialog"]')!;

        expect(dialog.textContent).toContain('Delete the collection "docs" and everything ingested into it from Weaviate? This can\'t be undone.');
        expect(dialog.textContent).not.toContain('no owner key');
        expect(deleteCollection).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

        expect(deleteCollection).toHaveBeenCalledWith(docs, defaultRagNodeData.collectionName);
        // The bin deletes; it doesn't pick the collection.
        expect(onPickCollection).not.toHaveBeenCalled();
    });

    it('says so when the collection has no owner key, and deletes nothing on Cancel', () => {
        const {deleteCollection} = withCollections({id: 'Open', value: 'open', owned: false, deletable: true});

        fireEvent.click(screen.getByRole('button', {name: 'Delete "open"'}));

        // By its title's text: every BaseDialog is labelled by the same id, so its name is the first open dialog's.
        const dialog = screen.getByText('Delete the Collection').closest<HTMLElement>('[role="dialog"]')!;

        expect(dialog.textContent).toContain('It has no owner key, so anyone can delete it.');
        fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
        expect(deleteCollection).not.toHaveBeenCalled();
    });

    it('keeps its message while it fades out after Delete, instead of emptying into a smaller box', () => {
        withCollections({id: 'Docs', value: 'docs', owned: true, deletable: true});
        fireEvent.click(screen.getByRole('button', {name: 'Delete "docs"'}));

        const dialog = screen.getByText('Delete the Collection').closest<HTMLElement>('[role="dialog"]')!;

        fireEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

        // Still mounted for its exit transition: it must still read as it did.
        expect(dialog.isConnected).toBe(true);
        expect(dialog.textContent).toContain('Delete the collection "docs"');
    });

    it('shows why a delete failed under the collection name, where the logs behind the dialog can\'t be seen', async () => {
        const reason = 'Couldn\'t delete collection "docs": Failed to fetch';

        withCollectionsDeleting(reason, {id: 'Docs', value: 'docs', owned: true, deletable: true});
        fireEvent.click(screen.getByRole('button', {name: 'Delete "docs"'}));
        fireEvent.click(within(screen.getByText('Delete the Collection').closest<HTMLElement>('[role="dialog"]')!).getByRole('button', {name: 'Delete'}));

        expect(await screen.findByText(reason)).toBeTruthy();
        expect(screen.queryByText('Namespace for this knowledge base in Weaviate')).toBeNull();

        // Opening the list again starts over.
        fireEvent.click(document.getElementById('dropdown-button')!);
        expect(screen.queryByText(reason)).toBeNull();
    });
});
