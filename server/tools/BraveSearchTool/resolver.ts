/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {BraveResult} from "./types.ts";
import {fetchBraveSearchResults} from "./service.ts";
import {graphqlMethodName} from "./schema.ts";


export const resolver = {
    [graphqlMethodName]: async (
        _parent: unknown,
        {query, maxResults}: { query: string, maxResults: number },
        {request}: GraphQLContext
    ): Promise<BraveResult[]> => {
        if (!query || !maxResults) {
            throw new Error("Missing query or maxResults parameter");
        }

        const authHeader = request?.headers?.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("Missing or invalid Authorization header");
        }

        const apiKey = authHeader.substring(7);

        return await fetchBraveSearchResults(query, apiKey, maxResults);
    }
};