/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {DuckDuckGoResult} from "@shared/types.gen";
import {graphqlRequest} from "../../../../../../utils";


export class GraphQLService {
    static async duckDuckGoSearch (query: string, userConfig: { maxResults: number, browserPath?: string }): Promise<DuckDuckGoResult[]> {
        const data = await graphqlRequest<{ duckDuckGoSearch: DuckDuckGoResult[] }>(
            /* GraphQL */ `
                query($query: String!, $maxResults: Int, $browserPath: String) {
                    duckDuckGoSearch(query: $query, maxResults: $maxResults, browserPath: $browserPath) {
                        sourceAndUrl
                        title
                        description
                        url
                    }
                }
            `,
            {query, maxResults: userConfig.maxResults, browserPath: userConfig.browserPath}
        );

        return data.duckDuckGoSearch;
    }
}