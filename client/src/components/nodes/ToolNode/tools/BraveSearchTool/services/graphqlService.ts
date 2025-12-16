/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {BraveResult} from "@shared/types.gen";
import {graphqlBaseUrl} from "../../../../../../utils";


export class GraphQLService {
    static async braveSearch (query: string, userConfig: { apiKey: string, maxResults: number }): Promise<BraveResult[]> {
        try {
            const response = await fetch(graphqlBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userConfig.apiKey}`
                },
                body: JSON.stringify({
                    query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int) {
                        braveSearch(query: $query, maxResults: $maxResults) {
                            title
                            url
                            description
                        }
                    }
                `,
                    variables: {query, maxResults: userConfig.maxResults}
                })
            });

            const {data, errors} = await response.json();

            if (errors) {
                throw new Error(errors.map((e: any) => e.message).join('\n'));
            }

            return data.braveSearch;
        } catch (error) {
            console.error("Brave Search error:", error);
            throw new Error(error instanceof Error ? error.message : 'Unknown error');
        }
    }
}