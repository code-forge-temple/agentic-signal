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
    ownerKey?: string;
};

type RagDeleteCollectionParams = {
    collectionName: string;
    weaviateUrl: string;
    weaviateApiKey?: string;
    ownerKey?: string;
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
                    $ownerKey: String
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
                        ownerKey: $ownerKey
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

    /** Deletes a collection the app made; throws why the server refused (another owner key, not the app's, Weaviate). */
    async deleteCollection (params: RagDeleteCollectionParams): Promise<void> {
        const data = await graphqlRequest<{ ragDeleteCollection: { success: boolean; error: string | null } }>(
            /* GraphQL */ `
                mutation RagDeleteCollection($collectionName: String!, $weaviateUrl: String!, $weaviateApiKey: String, $ownerKey: String) {
                    ragDeleteCollection(collectionName: $collectionName, weaviateUrl: $weaviateUrl, weaviateApiKey: $weaviateApiKey, ownerKey: $ownerKey) {
                        success
                        error
                    }
                }
            `,
            params
        );

        if (!data.ragDeleteCollection.success) throw new Error(data.ragDeleteCollection.error || "The collection couldn't be deleted");
    }
}

export const ragService = new RagService();
