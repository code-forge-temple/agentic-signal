/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CloudStorageFileResult} from "@shared/types.gen";
import {graphqlBaseUrl} from "../../../../../../utils";


export class GraphQLService {
    static async gdriveFetchFiles (query: string, userConfig: { accessToken: string, maxResults: number }): Promise<CloudStorageFileResult[]> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userConfig.accessToken}`
            },
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int!) {
                        gdriveFetchFiles(query: $query, maxResults: $maxResults) {
                            id
                            name
                            mimeType
                            webViewLink
                            modifiedTime
                            size
                            owners
                            content
                        }
                    }
                `,
                variables: {
                    query,
                    maxResults: userConfig.maxResults
                }
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.gdriveFetchFiles;
    }
}