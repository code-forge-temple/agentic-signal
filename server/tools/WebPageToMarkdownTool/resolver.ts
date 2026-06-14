/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {WebPageToMarkdownResult} from "./types.ts";
import {fetchWebPageAsMarkdown} from "./service.ts";
import {graphqlMethodName} from "./schema.ts";


export const resolver = {
    Query: {
        [graphqlMethodName]: async (
            _parent: unknown,
            {urls, browserPath}: { urls: string[], browserPath?: string },
            _context: GraphQLContext
        ): Promise<WebPageToMarkdownResult[]> => {
            if (!urls || urls.length === 0) {
                throw new Error("Missing urls parameter");
            }

            return await Promise.all(
                urls.map(url => fetchWebPageAsMarkdown(url, browserPath))
            );
        }
    }
};
