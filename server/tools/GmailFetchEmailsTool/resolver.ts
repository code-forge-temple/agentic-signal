/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {EmailResult} from "./types.ts";
import {fetchGmailEmails} from "./service.ts";
import {graphqlMethodName} from "./schema.ts";


export const resolver = {
    Query: {
        [graphqlMethodName]: async (
            _parent: unknown,
            {query, maxResults}: { query: string, maxResults: number },
            {request}: GraphQLContext
        ): Promise<EmailResult[]> => {
            if (!query) throw new Error("Missing query parameter");

            if (!maxResults || maxResults < 1 || maxResults > 50) throw new Error("maxResults must be between 1 and 50");

            const authHeader = request?.headers?.get('authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error("Missing or invalid Authorization header");

            const accessToken = authHeader.substring(7);

            return await fetchGmailEmails({query, maxResults, accessToken});
        }
    }
};