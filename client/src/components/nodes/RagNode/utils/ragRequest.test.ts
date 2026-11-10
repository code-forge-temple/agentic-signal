/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {ragRequest} from './ragRequest';
import {defaultRagNodeData} from '../types/workflow';


const settings = {embeddingModel: 'nomic-embed-text', collectionName: 'docs', chunkSize: 256, chunkOverlap: 32, topK: 3, weaviateUrl: 'http://weaviate:8080'};

describe('ragRequest', () => {
    it('sends the node\'s settings with the input and the hosts', () => {
        expect(ragRequest({input: 'question', settings, weaviateApiKey: 'key', ollamaHost: 'http://ollama:11434'}))
            .toEqual({input: 'question', ...settings, weaviateApiKey: 'key', ollamaHost: 'http://ollama:11434'});
    });

    it('falls back to the defaults for empty names and missing numbers', () => {
        const empty = {embeddingModel: '', collectionName: '', weaviateUrl: ''} as typeof settings;

        expect(ragRequest({input: 'q', settings: empty, weaviateApiKey: '', ollamaHost: 'h'})).toMatchObject({
            embeddingModel: '',
            collectionName: defaultRagNodeData.collectionName,
            chunkSize: defaultRagNodeData.chunkSize,
            chunkOverlap: defaultRagNodeData.chunkOverlap,
            topK: defaultRagNodeData.topK,
            weaviateUrl: defaultRagNodeData.weaviateUrl,
        });
    });
});
