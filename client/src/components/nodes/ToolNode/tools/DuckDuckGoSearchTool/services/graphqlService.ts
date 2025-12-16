/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {DuckDuckGoResult} from "@shared/types.gen";
import {graphqlBaseUrl} from "../../../../../../utils";


export class GraphQLService {
    static async duckDuckGoSearch (query: string, userConfig: { maxResults: number, browserPath?: string }): Promise<DuckDuckGoResult[]> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int, $browserPath: String) {
                        duckDuckGoSearch(query: $query, maxResults: $maxResults, browserPath: $browserPath) {
                            sourceAndUrl
                            title
                            description
                            url
                        }
                    }
                `,
                variables: {query, maxResults: userConfig.maxResults, browserPath: userConfig.browserPath}
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.duckDuckGoSearch;
    }
}