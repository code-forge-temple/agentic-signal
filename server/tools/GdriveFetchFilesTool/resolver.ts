/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {CloudStorageFileResult} from "./types.ts";
import {fetchGdriveFiles} from "./service.ts";
import {graphqlMethodName} from "./schema.ts";

export const resolver = {
    [graphqlMethodName]: async (
        _parent: unknown,
        {query, maxResults}: {query: string, maxResults: number},
        {request}: GraphQLContext
    ): Promise<CloudStorageFileResult[]> => {
        if (!query) throw new Error("Missing query parameter");

        if (!maxResults || maxResults < 1 || maxResults > 100) throw new Error("maxResults must be between 1 and 100");

        const authHeader = request?.headers?.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error("Missing or invalid Authorization header");

        const accessToken = authHeader.substring(7);

        return await fetchGdriveFiles({query, maxResults, accessToken});
    }
};