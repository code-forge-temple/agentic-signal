/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {DuckDuckGoResultFields} from "./types.ts";
import {generateGraphQLType} from "../../utils/graphqlUtils.ts";


export const graphqlMethodName = "duckDuckGoSearch";

export const graphqlResultTypeName = "DuckDuckGoResult"

export const typeDefs = `${generateGraphQLType(graphqlResultTypeName, DuckDuckGoResultFields)}`;

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(query: String!, maxResults: Int, browserPath: String): [${graphqlResultTypeName}]`;