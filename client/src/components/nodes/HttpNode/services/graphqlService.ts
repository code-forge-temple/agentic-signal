/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {graphqlRequest} from "../../../../utils";


export class GraphQLService {
    static async renderHtml (url: string, browserPath?: string): Promise<string> {
        const data = await graphqlRequest<{ renderHtml: string | null }>(
            /* GraphQL */ `
                query($url: String!, $browserPath: String) {
                    renderHtml(url: $url, browserPath: $browserPath)
                }
            `,
            {url, browserPath}
        );

        if (!data.renderHtml) {
            throw new Error("No HTML returned from backend");
        }

        return data.renderHtml;
    }
}