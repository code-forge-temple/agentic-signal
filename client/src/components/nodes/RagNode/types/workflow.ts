/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseNodeData} from "../../../../types/workflow";
import type {Node} from "@xyflow/react";
import {NODE_TYPE} from "../constants";


export type RagNodeData = {
    embeddingModel: string;
    collectionName: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    weaviateUrl: string;
    weaviateApiKey?: string;
    handler?: (input: string) => Promise<string>;
};

export function assertIsRagNodeData (data: unknown): asserts data is RagNodeData {
    if (
        typeof data !== "object" || data === null ||
        !("embeddingModel" in data) || typeof (data as any).embeddingModel !== "string" ||
        !("collectionName" in data) || typeof (data as any).collectionName !== "string" ||
        !("weaviateUrl" in data) || typeof (data as any).weaviateUrl !== "string"
    ) {
        throw new Error("Node data is not RagNodeData");
    }

    if ("handler" in data && data.handler !== undefined && typeof data.handler !== "function") {
        throw new Error("Node data handler must be a function if provided");
    }
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
