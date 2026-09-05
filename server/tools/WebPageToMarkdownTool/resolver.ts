/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {WebPageToMarkdownResult} from "./types.ts";
import {fetchWebPageAsMarkdown} from "./service.ts";
import {graphqlMethodName} from "./schema.ts";


// Each URL opens its own real (non-headless) browser window — see service.ts.
// Callers (an LLM interpreting a prompt) can't be relied on to self-limit how
// many URLs they pass in one call, so the cap lives here instead, where it's
// guaranteed regardless of prompt wording or model behavior.
const MAX_CONCURRENT_PAGES = 3;

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

            const results: WebPageToMarkdownResult[] = [];

            for (let i = 0; i < urls.length; i += MAX_CONCURRENT_PAGES) {
                const batch = urls.slice(i, i + MAX_CONCURRENT_PAGES);

                results.push(...await Promise.all(batch.map(url => fetchWebPageAsMarkdown(url, browserPath))));
            }

            return results;
        }
    }
};
