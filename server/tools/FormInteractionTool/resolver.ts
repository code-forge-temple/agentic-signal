/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {FormInteractionArgs, FormInteractionResult} from "./types.ts";
import {interactWithForm} from "./service.ts";
import {closeFormSessionsMethodName, graphqlMethodName} from "./schema.ts";
import {closeSessionsByPrefix} from "./utils/sessionManager.ts";


export const resolver = {
    Query: {
        [graphqlMethodName]: async (
            _parent: unknown,
            args: FormInteractionArgs,
            _context: GraphQLContext
        ): Promise<FormInteractionResult> => {
            return await interactWithForm(args);
        },
        [closeFormSessionsMethodName]: async (
            _parent: unknown,
            args: {sessionId: string},
            _context: GraphQLContext
        ): Promise<boolean> => {
            await closeSessionsByPrefix(args.sessionId);

            return true;
        },
    },
};
