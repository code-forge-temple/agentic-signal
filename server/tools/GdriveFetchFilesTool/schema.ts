/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {CloudStorageFileResultFields} from "./types.ts";


export const graphqlMethodName = "gdriveFetchFiles";

export const graphqlResultTypeName = "CloudStorageFileResult"

export const typeDefs = `${generateGraphQLType(graphqlResultTypeName, CloudStorageFileResultFields)}`;

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(query: String!, maxResults: Int!): [${graphqlResultTypeName}]`;