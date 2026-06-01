/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {DuckDuckGoResult} from "./types.ts";
import {fetchDuckDuckGoResults} from "./service.ts";
import {graphqlMethodName} from "./schema.ts";

export const resolver = {
    Query: {
        [graphqlMethodName]: async (
            _parent: unknown,
            {query, maxResults, browserPath}: { query: string, maxResults: number, browserPath?: string },
            _context: GraphQLContext
        ): Promise<DuckDuckGoResult[]> => {
            if (!query || !maxResults) {
                throw new Error("Missing query or maxResults parameter");
            }

            let results: DuckDuckGoResult[];

            try {
                results = await fetchDuckDuckGoResults(query, browserPath);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                throw new Error(`DuckDuckGo query failed: ${message}`);
            }

            return results.slice(0, maxResults);
        }
    }
};