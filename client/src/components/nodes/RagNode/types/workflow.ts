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
    handler: z.function().args(z.string()).returns(z.promise(z.string())).optional(),
});

export type RagNodeData = z.infer<typeof RagNodeDataSchema>;

export function assertIsRagNodeData (data: unknown): asserts data is RagNodeData {
    RagNodeDataSchema.parse(data);
}

export type RagNode = Node<BaseNodeData & RagNodeData> & {type: typeof NODE_TYPE};

export const defaultRagNodeData: RagNodeData = {
    embeddingModel: "",
    collectionName: "rag_collection",
    chunkSize: 512,
    chunkOverlap: 64,
    topK: 5,
    weaviateUrl: "http://localhost:8080",
    weaviateApiKey: "",
    handler: undefined,
};
