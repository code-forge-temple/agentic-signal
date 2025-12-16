/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {BraveResultFields} from "./types.ts";


export const graphqlMethodName = "braveSearch";

export const graphqlResultTypeName = "BraveResult"

export const typeDefs = `${generateGraphQLType(graphqlResultTypeName, BraveResultFields)}`;

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(query: String!, maxResults: Int): [${graphqlResultTypeName}]`;