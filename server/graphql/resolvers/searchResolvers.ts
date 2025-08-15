/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {
    GraphQLContext,
    DuckDuckGoResult,
    BraveResult
} from '../types.ts';


export const searchResolvers = {
    duckDuckGoSearch: async (
        _parent: unknown,
        {query, maxResults}: { query: string, maxResults: number },
        {services}: GraphQLContext
    ): Promise<DuckDuckGoResult[]> => {
        if (!query || !maxResults) {
            throw new Error("Missing query or maxResults parameter");
        }

        try {
            const results = await services.fetchDuckDuckGoResults(query);

            return results.slice(0, maxResults);
        } catch (err) {
            throw new Error(
                typeof err === "object" && err !== null && "message" in err
                    ? (err as Error).message
                    : String(err)
            );
        }
    },

    braveSearch: async (
        _parent: unknown,
        {query, maxResults}: { query: string, maxResults: number },
        {request}: GraphQLContext
    ): Promise<BraveResult[]> => {
        if (!query || !maxResults) {
            throw new Error("Missing query or maxResults parameter");
        }

        const authHeader = request?.headers?.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error("Missing or invalid Authorization header");
        }

        const apiKey = authHeader.substring(7);

        try {
            const params = new URLSearchParams({
                q: query,
                result_filter: 'web',
                count: maxResults.toString(),
            });

            const braveResponse = await fetch(
                `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
                {
                    headers: {
                        "Accept": "application/json",
                        "X-Subscription-Token": apiKey,
                    },
                }
            );
            const data = await braveResponse.json();

            console.log("Brave Search:", data.web?.results);

            return data.web?.results || [];
        } catch (err) {
            throw new Error(
                typeof err === "object" && err !== null && "message" in err
                    ? (err as Error).message
                    : String(err)
            );
        }
    },
};