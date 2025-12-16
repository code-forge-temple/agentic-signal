/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {graphqlMethodName} from "./schema.ts";
import {fetchRenderedHtml} from "./service.ts";


export const resolver = {
    [graphqlMethodName]: async (
        _parent: unknown,
        {url, browserPath}: { url: string, browserPath?: string },
        _context: GraphQLContext
    ): Promise<string> => {
        if (!url) throw new Error("Missing url parameter");

        return await fetchRenderedHtml(url, browserPath);
    }
};