/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {graphqlBaseUrl} from "../../../../utils";


export class GraphQLService {
    static async renderHtml (url: string, browserPath?: string): Promise<string> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($url: String!, $browserPath: String) {
                        renderHtml(url: $url, browserPath: $browserPath)
                    }
                `,
                variables: {url, browserPath}
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        if (!data.renderHtml) {
            throw new Error("No HTML returned from backend");
        }

        return data.renderHtml;
    }
}