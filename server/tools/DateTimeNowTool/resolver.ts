/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {graphqlMethodName} from "./schema.ts";
import {TimezoneResult} from "./types.ts";
import {getTimezoneForCity} from "./service.ts";


export const resolver = {
    Query: {
        [graphqlMethodName]: async (
            _parent: unknown,
            {city}: { city: string },
            _context: GraphQLContext
        ): Promise<TimezoneResult> => {
            return await getTimezoneForCity(city);
        }
    }
};