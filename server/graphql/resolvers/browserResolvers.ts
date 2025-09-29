/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from '../types.ts';


export const browserResolvers = {
    renderHtml: async (_parent: unknown, {url, browserPath}: { url: string, browserPath?: string }, {services}: GraphQLContext): Promise<string> => {
        if (!url) {
            throw new Error("Missing url parameter");
        }

        try {
            const html = await services.fetchRenderedHtml(url, browserPath);

            return html;
        } catch (err) {
            throw new Error(
                typeof err === "object" && err !== null && "message" in err
                    ? (err as Error).message
                    : String(err)
            );
        }
    },
};