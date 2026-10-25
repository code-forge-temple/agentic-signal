/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimezoneResult} from "@shared/types.gen";
import {graphqlRequest} from "../../../../../../utils";


export class GraphQLService {
    static async getTimezoneForCity (city: string): Promise<TimezoneResult> {
        const data = await graphqlRequest<{ getTimezoneForCity: TimezoneResult }>(
            /* GraphQL */ `
                query($city: String!) {
                    getTimezoneForCity(city: $city) {
                        iso
                        locale
                        unix
                        timezone
                        city
                        utc_offset
                        error
                    }
                }
            `,
            {city}
        );

        return data.getTimezoneForCity;
    }
}