/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlBaseUrl} from "../../../../utils";


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
        const response = await fetch(graphqlBaseUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                query: /* GraphQL */ `
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
                variables: params,
            }),
        });

        const {data, errors} = await response.json();

        if (errors?.length) {
            throw new Error(errors.map((e: any) => e.message).join("\n"));
        }

        const result = data.ragIngestAndRetrieve;

        if (!result.success) {
            throw new Error(result.error || "RAG operation failed");
        }

        console.log("RAG Result:", data);

        return result.context || "";
    }
}

export const ragService = new RagService();
