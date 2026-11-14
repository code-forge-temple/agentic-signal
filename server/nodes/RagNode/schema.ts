/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {RagDeleteCollectionResultFields, RagRetrieveResultFields} from "./types.ts";

export const graphqlTypeName = "RagRetrieveResult";

export const typeDefs = /* GraphQL */ `
${generateGraphQLType(graphqlTypeName, RagRetrieveResultFields)}
${generateGraphQLType("RagDeleteCollectionResult", RagDeleteCollectionResultFields)}
`;

export const queryDefs = "";

export const mutationDefs = /* GraphQL */ `
    ragIngestAndRetrieve(
        input: String!
        collectionName: String!
        embeddingModel: String!
        chunkSize: Int!
        chunkOverlap: Int!
        topK: Int!
        ollamaHost: String
        weaviateUrl: String!
        weaviateApiKey: String
        ownerKey: String
    ): RagRetrieveResult!
    ragDeleteCollection(
        collectionName: String!
        weaviateUrl: String!
        weaviateApiKey: String
        ownerKey: String
    ): RagDeleteCollectionResult!
`;
