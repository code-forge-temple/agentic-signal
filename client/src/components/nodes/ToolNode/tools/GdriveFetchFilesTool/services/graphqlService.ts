/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CloudStorageFileResult} from "@shared/types.gen";
import {graphqlRequest} from "../../../../../../utils";


export class GraphQLService {
    static async gdriveFetchFiles (query: string, userConfig: { accessToken: string, maxResults: number }): Promise<CloudStorageFileResult[]> {
        const data = await graphqlRequest<{ gdriveFetchFiles: CloudStorageFileResult[] }>(
            /* GraphQL */ `
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
            {query, maxResults: userConfig.maxResults},
            {Authorization: `Bearer ${userConfig.accessToken}`}
        );

        return data.gdriveFetchFiles;
    }
}