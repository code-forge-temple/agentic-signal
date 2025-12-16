/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {EmailResultFields} from "./types.ts";


export const graphqlMethodName = "gmailFetchEmails";

export const graphqlResultTypeName = "EmailResult"

export const typeDefs = `${generateGraphQLType(graphqlResultTypeName, EmailResultFields)}`;

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(query: String!, maxResults: Int!): [${graphqlResultTypeName}]`;