/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from "@xyflow/react";
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const RagNodeDataSchema = z.object({
    embeddingModel: z.string().describe("Ollama model name to use for generating embeddings"),
    collectionName: z.string().describe("Weaviate collection name to store/query vectors"),
    chunkSize: z.number().int().positive().describe("Number of tokens per text chunk when splitting documents"),
    chunkOverlap: z.number().int().nonnegative().describe("Number of overlapping tokens between consecutive chunks"),
    topK: z.number().int().positive().describe("Number of top matching chunks to retrieve"),
    weaviateUrl: z.string().describe("URL of the Weaviate vector database instance"),
    weaviateApiKey: z.string().optional().describe("API key for Weaviate (leave empty for local instances)"),
    // eslint-disable-next-line max-len
    ownerKey: z.string().optional().describe("Owner key: a collection made with it can be changed (files added or replaced, its model changed) or deleted only with it; anyone may query it. Kept in Credentials, never in workflow files"),
    handler: z.function().args(z.string()).returns(z.promise(z.string())).optional(),
});

export type RagNodeData = z.infer<typeof RagNodeDataSchema>;

export function assertIsRagNodeData (data: unknown): asserts data is RagNodeData {
    RagNodeDataSchema.parse(data);
}

export type RagNode = Node<BaseNodeData & RagNodeData> & {type: typeof NODE_TYPE};

export const defaultRagNodeData: RagNodeData = {
    embeddingModel: "",
    // DEFAULT_RAG_COLLECTION, written out: the docs schema generator can only stub "@shared/types.gen" imports here
    // (a test keeps the two the same).
    collectionName: "rag_collection",
    chunkSize: 512,
    chunkOverlap: 64,
    topK: 5,
    // Not 8080, Weaviate's own port: the web app listens there, and so does the desktop app after a Google or Reddit sign-in.
    weaviateUrl: "http://localhost:9090",
    weaviateApiKey: "",
    ownerKey: "",
    handler: undefined,
};
