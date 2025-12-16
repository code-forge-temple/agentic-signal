/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimezoneResult} from "@shared/types.gen";
import {graphqlBaseUrl} from "../../../../../../utils";


export class GraphQLService {
    static async getTimezoneForCity (city: string): Promise<TimezoneResult> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
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
                variables: {city}
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.getTimezoneForCity;
    }
}