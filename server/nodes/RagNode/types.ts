/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";

export const RAG_NODE_TYPE = "rag";

/**
 * Weaviate's `/v1/objects?class=<Collection>Meta` response: the one meta object per RAG collection.
 * Shared with the client (via @shared/types.gen), which reads it to list collections, lock the
 * embedding model and tell which collections its owner key may delete; the server reads it to skip
 * re-ingesting unchanged files and to refuse changes from another key.
 */
export const WeaviateMetaObjectsResponseSchema = z.object({
    objects: z.array(z.object({
        id: z.string(),
        properties: z.object({
            documentHash: z.string().nullish(),
            embeddingModel: z.string().nullish(),
            originalName: z.string().nullish(),
            // The owner key's fingerprint (ragOwnerKeyHash), set when the collection is made; none: open to all.
            ownerKeyHash: z.string().nullish(),
        }),
    })).nullish(),
});

export type RagIngestAndRetrieveArgs = {
    input: string;
    collectionName: string;
    embeddingModel: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    ollamaHost?: string;
    weaviateUrl: string;
    weaviateApiKey?: string;
    ownerKey?: string;
};

export type RagDeleteCollectionArgs = {
    collectionName: string;
    weaviateUrl: string;
    weaviateApiKey?: string;
    ownerKey?: string;
};

export type RagDeleteCollectionResult = {
    success: boolean;
    error: string | null;
};

export const RagDeleteCollectionResultFields: Record<string, string> = {
    success: "Boolean!",
    error: "String",
};

export type RagRetrieveResult = {
    success: boolean;
    context: string | null;
    error: string | null;
};

export const RagRetrieveResultFields: Record<string, string> = {
    success: "Boolean!",
    context: "String",
    error: "String",
};
