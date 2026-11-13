/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, Mock, vi} from 'vitest';
import {FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX, useWeaviateCollections} from './useWeaviateCollections';
import {defaultRagNodeData} from '../types/workflow';
import {DEFAULT_RAG_COLLECTION} from '@shared/constants';


type Answer = {status?: number; body?: unknown} | Error;

const META = {
    Docs: {objects: [{id: '1', properties: {originalName: 'docs', embeddingModel: 'nomic'}}]},
    Notes: {objects: [{id: '2', properties: {originalName: 'notes'}}]},
    Raw: {objects: []},
    // The node's default collection, "rag_collection".
    Ragcollection: {objects: [{id: '9', properties: {originalName: 'rag_collection', embeddingModel: 'mxbai'}}]},
};

let answers: Record<string, Answer>;
let fetchMock: Mock;

const schemaWith = (...classes: string[]) => ({body: {classes: classes.map(name => ({class: name}))}});

beforeEach(() => {
    answers = {
        // Raw was made outside the app: no meta class. Meta is the class of a collection named "meta".
        '/v1/schema': schemaWith('Docs', 'DocsMeta', 'Notes', 'NotesMeta', 'Raw', 'Meta'),
        ...Object.fromEntries(Object.entries(META).map(([name, body]) => [`/v1/objects?class=${name}Meta&limit=1`, {body}])),
        // Each class's own schema, and its meta class's (but Raw's): a class Weaviate doesn't have answers 404.
        ...Object.fromEntries(Object.keys(META).map(name => [`/v1/schema/${name}`, {body: {class: name}}])),
        ...Object.fromEntries(Object.keys(META).filter(name => name !== 'Raw').map(name => [`/v1/schema/${name}Meta`, {body: {class: `${name}Meta`}}])),
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

        expect(current().availableCollections).toEqual([{id: 'Docs', value: 'docs'}, {id: 'Notes', value: 'notes'}, {id: 'Raw', value: 'Raw'}, {id: 'Meta', value: 'Meta'}]);
        expect(current().loadingCollections).toBe(false);
        expect(onError).not.toHaveBeenCalled();
        expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).headers && JSON.stringify((init as RequestInit).headers).includes('wk'))).toBe(true);
    });

    it('falls back to the class name when a meta object can\'t be read', async () => {
        answers['/v1/objects?class=NotesMeta&limit=1'] = new Error('network');
        answers['/v1/objects?class=DocsMeta&limit=1'] = {status: 500};
        const {current} = setup();

        await act(() => current().fetchCollections());

        expect(current().availableCollections).toEqual([{id: 'Docs', value: 'Docs'}, {id: 'Notes', value: 'Notes'}, {id: 'Raw', value: 'Raw'}, {id: 'Meta', value: 'Meta'}]);
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

        await act(() => current().selectCollection({id: 'Docs', value: 'docs'}));

        expect(onConfigChange.mock.calls).toEqual([['n1', {collectionName: 'docs'}], ['n1', {embeddingModel: 'nomic'}]]);
        expect(current().isEmbeddingModelLocked).toBe(true);

        await act(() => current().selectCollection({id: 'Notes', value: 'notes'}));

        expect(current().isEmbeddingModelLocked).toBe(false);
    });

    it('locks to the model of the collection a run would write into: the class of the name, as the server derives it', async () => {
        const {current, onConfigChange} = setup();

        // "do_cs" and "docs" are both the class Docs (embedded with nomic), whatever its meta calls it.
        for (const name of ['docs', 'do_cs']) {
            await act(() => current().checkCollectionLockByName(name));
            expect(current().isEmbeddingModelLocked).toBe(true);
            expect(onConfigChange).toHaveBeenLastCalledWith('n1', {embeddingModel: 'nomic'});
        }

        // No name: a run sends the node's default, "rag_collection" (class Ragcollection).
        await act(() => current().checkCollectionLockByName(''));
        expect(onConfigChange).toHaveBeenLastCalledWith('n1', {embeddingModel: 'mxbai'});

        const asked = (name: string) => [`/v1/schema/${name}`, `/v1/schema/${name}Meta`, `/v1/objects?class=${name}Meta&limit=1`];

        expect(fetchMock.mock.calls.map(([url]) => String(url).replace('http://weaviate:8080', ''))).toEqual([...asked('Docs'), ...asked('Docs'), ...asked('Ragcollection')]);
    });

    it('unlocks for a collection without a model, or one Weaviate does not have', async () => {
        const {current} = setup();

        // Raw has no meta class (made outside the app): no model to lock to either.
        for (const name of ['notes', 'nope', 'raw']) {
            await act(() => current().checkCollectionLockByName('docs'));
            await act(() => current().checkCollectionLockByName(name));
            expect(current().isEmbeddingModelLocked, name).toBe(false);
        }
    });

    it('keeps the lock as it is when Weaviate cannot tell (down, the key turned down): unlocking could let a model change wipe it', async () => {
        const {current} = setup();
        const failures = [
            ['/v1/schema/Docs', new Error('offline')],
            ['/v1/schema/Docs', {status: 401}],
            ['/v1/objects?class=DocsMeta&limit=1', {status: 503}],
        ] as const;

        await act(() => current().checkCollectionLockByName('docs'));

        for (const [route, answer] of failures) {
            answers[route] = answer;
            await act(() => current().checkCollectionLockByName('docs'));
            expect(current().isEmbeddingModelLocked, route).toBe(true);
            answers['/v1/schema/Docs'] = {body: {class: 'Docs'}};
            answers['/v1/objects?class=DocsMeta&limit=1'] = {body: META.Docs};
        }
    });

    it('drops an answer that comes after a newer check\'s: picking two collections quickly', async () => {
        let answerDocs: (() => void) | undefined;
        const realFetch = fetchMock.getMockImplementation()!;

        fetchMock.mockImplementation((url: string) => (url.includes('objects?class=DocsMeta')
            ? new Promise<Response>((resolve) => {
                answerDocs = () => resolve(new Response(JSON.stringify(META.Docs)));
            })
            : realFetch(url)));

        const {current, onConfigChange} = setup();
        let first: Promise<void> = Promise.resolve();

        await act(async () => {
            first = current().selectCollection({id: 'Docs', value: 'docs'});
            await current().selectCollection({id: 'Notes', value: 'notes'});
        });
        await act(async () => {
            answerDocs!();
            await first;
        });

        // Notes, picked last, has no model: Docs' late answer must not lock it to nomic.
        expect(current().isEmbeddingModelLocked).toBe(false);
        expect(onConfigChange).not.toHaveBeenCalledWith('n1', {embeddingModel: 'nomic'});
    });
});

describe('the RAG node\'s default collection', () => {
    it('is the one the server and ragClassName fall back to', () => {
        expect(defaultRagNodeData.collectionName).toBe(DEFAULT_RAG_COLLECTION);
    });
});
