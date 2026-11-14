/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {defaultRagNodeData, RagNodeData} from "../types/workflow";


type RagSettings = Pick<RagNodeData, "embeddingModel" | "collectionName" | "chunkSize" | "chunkOverlap" | "topK" | "weaviateUrl">;

type RagRequestOptions = {
    input: string;
    settings: RagSettings;
    weaviateApiKey: string;
    ownerKey: string;
    ollamaHost: string;
};

/** What the RAG service gets for one input: the node's settings, each falling back to its default, and the hosts. */
export const ragRequest = ({input, settings, weaviateApiKey, ownerKey, ollamaHost}: RagRequestOptions) => ({
    input,
    collectionName: settings.collectionName || defaultRagNodeData.collectionName,
    embeddingModel: settings.embeddingModel || "",
    chunkSize: settings.chunkSize ?? defaultRagNodeData.chunkSize,
    chunkOverlap: settings.chunkOverlap ?? defaultRagNodeData.chunkOverlap,
    topK: settings.topK ?? defaultRagNodeData.topK,
    ollamaHost,
    weaviateUrl: settings.weaviateUrl || defaultRagNodeData.weaviateUrl,
    weaviateApiKey,
    ownerKey,
});
