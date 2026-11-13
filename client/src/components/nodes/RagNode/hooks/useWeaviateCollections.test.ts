/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, Mock, vi} from 'vitest';
import {FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX, useWeaviateCollections} from './useWeaviateCollections';


type Answer = {status?: number; body?: unknown} | Error;

const META = {
    Docs: {objects: [{id: '1', properties: {originalName: 'my docs', embeddingModel: 'nomic'}}]},
    Notes: {objects: [{id: '2', properties: {originalName: 'notes'}}]},
    Raw: {objects: []},
};

let answers: Record<string, Answer>;
let fetchMock: Mock;

const schemaWith = (...classes: string[]) => ({body: {classes: classes.map(name => ({class: name}))}});

beforeEach(() => {
    answers = {
        '/v1/schema': schemaWith('Docs', 'DocsMeta', 'Notes', 'NotesMeta', 'Raw', 'RawMeta'),
        ...Object.fromEntries(Object.entries(META).map(([name, body]) => [`/v1/objects?class=${name}Meta&limit=1`, {body}])),
    };
    fetchMock = vi.fn(async (url: string) => {
        const answer = answers[url.replace('http://weaviate:8080', '')];

        if (answer instanceof Error) throw answer;

        return new Response(JSON.stringify(answer?.body ?? {}), {status: answer?.status ?? (answer ? 200 : 404)});
    });
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function setup () {
    const onConfigChange = vi.fn();
    const onError = vi.fn();
    const hook = renderHook(() => useWeaviateCollections({id: 'n1', weaviateUrl: 'http://weaviate:8080/', weaviateApiKey: 'wk', onConfigChange, onError}));

    return {hook, onConfigChange, onError, current: () => hook.result.current};
}

describe('useWeaviateCollections', () => {
    it('lists the collections by their original names (the class name when there is none), meta classes left out', async () => {
        const {current, onError} = setup();

        await act(() => current().fetchCollections());

        expect(current().availableCollections).toEqual([{id: 'Docs', value: 'my docs'}, {id: 'Notes', value: 'notes'}, {id: 'Raw', value: 'Raw'}]);
        expect(current().loadingCollections).toBe(false);
        expect(onError).not.toHaveBeenCalled();
        expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).headers && JSON.stringify((init as RequestInit).headers).includes('wk'))).toBe(true);
    });

    it('falls back to the class name when a meta object can\'t be read', async () => {
        answers['/v1/objects?class=NotesMeta&limit=1'] = new Error('network');
        answers['/v1/objects?class=DocsMeta&limit=1'] = {status: 500};
        const {current} = setup();

        await act(() => current().fetchCollections());

        expect(current().availableCollections).toEqual([{id: 'Docs', value: 'Docs'}, {id: 'Notes', value: 'Notes'}, {id: 'Raw', value: 'Raw'}]);
    });

    it('reports a schema Weaviate turns down, or can\'t answer, and lists nothing', async () => {
        const cases = [
            [{status: 401}, 'Weaviate returned 401'],
            [new Error('offline'), 'offline'],
            [{body: {classes: 'x'}}, 'Unexpected response from Weaviate\'s /v1/schema'],
        ] as const;

        for (const [answer, message] of cases) {
            answers['/v1/schema'] = answer;
            const {current, onError} = setup();

            await act(() => current().fetchCollections());

            expect(onError).toHaveBeenCalledWith(`${FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX}: ${message}`);
            expect(current().availableCollections).toEqual([]);
            cleanup();
        }
    });

    it('picking a collection sets its name and locks its embedding model, when it has one', async () => {
        const {current, onConfigChange} = setup();

        await act(() => current().selectCollection({id: 'Docs', value: 'my docs'}));

        expect(onConfigChange.mock.calls).toEqual([['n1', {collectionName: 'my docs'}], ['n1', {embeddingModel: 'nomic'}]]);
        expect(current().isEmbeddingModelLocked).toBe(true);

        await act(() => current().selectCollection({id: 'Notes', value: 'notes'}));

        expect(current().isEmbeddingModelLocked).toBe(false);
    });

    it('finds a collection by its original name to lock its model; unlocks for an unknown or empty name', async () => {
        const {current, onConfigChange} = setup();

        await act(() => current().checkCollectionLockByName('my docs'));
        expect(current().isEmbeddingModelLocked).toBe(true);
        expect(onConfigChange).toHaveBeenLastCalledWith('n1', {embeddingModel: 'nomic'});

        await act(() => current().checkCollectionLockByName('nope'));
        expect(current().isEmbeddingModelLocked).toBe(false);

        await act(() => current().checkCollectionLockByName('my docs'));
        await act(() => current().checkCollectionLockByName(''));
        expect(current().isEmbeddingModelLocked).toBe(false);
    });

    it('keeps the lock as it is when Weaviate turns the schema down, and unlocks when it can\'t answer', async () => {
        const {current} = setup();

        await act(() => current().checkCollectionLockByName('my docs'));

        answers['/v1/schema'] = {status: 401};
        await act(() => current().checkCollectionLockByName('notes'));
        expect(current().isEmbeddingModelLocked).toBe(true);

        answers['/v1/schema'] = new Error('offline');
        await act(() => current().checkCollectionLockByName('notes'));
        expect(current().isEmbeddingModelLocked).toBe(false);
    });

    it('skips a class whose meta object can\'t be read while looking for the name', async () => {
        answers['/v1/objects?class=DocsMeta&limit=1'] = new Error('network');
        const {current} = setup();

        await act(() => current().checkCollectionLockByName('notes'));

        // Found (Notes) but it has no model: not locked.
        expect(current().isEmbeddingModelLocked).toBe(false);
        expect(fetchMock.mock.calls.map(([url]) => String(url).replace('http://weaviate:8080', ''))).toEqual([
            '/v1/schema', '/v1/objects?class=DocsMeta&limit=1', '/v1/objects?class=NotesMeta&limit=1', '/v1/objects?class=NotesMeta&limit=1',
        ]);
    });
});
