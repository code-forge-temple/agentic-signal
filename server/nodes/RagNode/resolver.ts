/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {ragIngestAndRetrieve} from "./service.ts";
import {RagIngestAndRetrieveArgs, RagRetrieveResult} from "./types.ts";

export const resolver = {
    Query: {},
    Mutation: {
        ragIngestAndRetrieve: async (
            _parent: unknown,
            args: RagIngestAndRetrieveArgs,
            _context: GraphQLContext
        ): Promise<RagRetrieveResult> => {
            return ragIngestAndRetrieve(args);
        }
    }
};
