/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {BraveResult} from "@shared/types.gen";
import {graphqlRequest} from "../../../../../../utils";


export class GraphQLService {
    static async braveSearch (query: string, userConfig: { apiKey: string, maxResults: number }): Promise<BraveResult[]> {
        try {
            const data = await graphqlRequest<{ braveSearch: BraveResult[] }>(
                /* GraphQL */ `
                    query($query: String!, $maxResults: Int) {
                        braveSearch(query: $query, maxResults: $maxResults) {
                            title
                            url
                            description
                        }
                    }
                `,
                {query, maxResults: userConfig.maxResults},
                {Authorization: `Bearer ${userConfig.apiKey}`}
            );

            return data.braveSearch;
        } catch (error) {
            console.error("Brave Search error:", error);

            throw new Error(error instanceof Error ? error.message : 'Unknown error');
        }
    }
}