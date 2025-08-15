/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {
    GraphQLContext,
    TimezoneResult
} from '../types.ts';

export const timezoneResolvers = {
    getTimezoneForCity: async (
        _parent: unknown,
        {city}: {city: string},
        {services}: GraphQLContext
    ): Promise<TimezoneResult> => {
        try {
            const result = await services.getTimezoneForCity(city);

            return result;
        } catch (err) {
            throw new Error(
                typeof err === "object" && err !== null && "message" in err
                    ? (err as Error).message
                    : String(err)
            );
        }
    },
};