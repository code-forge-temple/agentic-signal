/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const RAG_NODE_TYPE = "rag";

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
