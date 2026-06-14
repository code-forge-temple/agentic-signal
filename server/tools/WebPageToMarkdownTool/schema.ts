/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {WebPageToMarkdownResultFields} from "./types.ts";


export const graphqlMethodName = "webPageToMarkdown";

export const graphqlResultTypeName = "WebPageToMarkdownResult";

export const typeDefs = `${generateGraphQLType(graphqlResultTypeName, WebPageToMarkdownResultFields)}`;

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(urls: [String!]!, browserPath: String): [${graphqlResultTypeName}]`;
