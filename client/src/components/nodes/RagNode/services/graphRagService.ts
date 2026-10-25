/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlRequest} from "../../../../utils";


type RagIngestAndRetrieveParams = {
    input: string;
    collectionName: string;
    embeddingModel: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    ollamaHost: string;
    weaviateUrl: string;
    weaviateApiKey?: string;
};

class RagService {
    async ingestAndRetrieve (params: RagIngestAndRetrieveParams): Promise<string> {
        const data = await graphqlRequest<{ ragIngestAndRetrieve: { success: boolean; context: string | null; error: string | null } }>(
            /* GraphQL */ `
                mutation RagIngestAndRetrieve(
                    $input: String!
                    $collectionName: String!
                    $embeddingModel: String!
                    $chunkSize: Int!
                    $chunkOverlap: Int!
                    $topK: Int!
                    $ollamaHost: String
                    $weaviateUrl: String!
                    $weaviateApiKey: String
                ) {
                    ragIngestAndRetrieve(
                        input: $input
                        collectionName: $collectionName
                        embeddingModel: $embeddingModel
                        chunkSize: $chunkSize
                        chunkOverlap: $chunkOverlap
                        topK: $topK
                        ollamaHost: $ollamaHost
                        weaviateUrl: $weaviateUrl
                        weaviateApiKey: $weaviateApiKey
                    ) {
                        success
                        context
                        error
                    }
                }
            `,
            params
        );

        const result = data.ragIngestAndRetrieve;

        if (!result.success) {
            throw new Error(result.error || "RAG operation failed");
        }

        return result.context || "";
    }
}

export const ragService = new RagService();
