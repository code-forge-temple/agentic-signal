/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CalendarEventResult} from "@shared/types.gen";
import {graphqlBaseUrl} from "../../../../../../utils";


export class GraphQLService {
    static async gcalendarFetchEvents (
        query: string,
        userConfig: {
            accessToken: string,
            maxResults: number,
            timeMin: string,
            timeMax: string,
        }): Promise<CalendarEventResult[]> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userConfig.accessToken}`
            },
            body: JSON.stringify({
                query: /* GraphQL */ `
                query($query: String!, $maxResults: Int!, $timeMin: String!, $timeMax: String!) {
                    gcalendarFetchEvents(query: $query, maxResults: $maxResults, timeMin: $timeMin, timeMax: $timeMax) {
                        id
                        summary
                        description
                        start {
                            dateTime
                            date
                            timeZone
                        }
                        end {
                            dateTime
                            date
                            timeZone
                        }
                        location
                        attendees {
                            email
                            displayName
                        }
                        creator {
                            email
                            displayName
                        }
                        htmlLink
                        status
                    }
                }
            `,
                variables: {
                    query,
                    maxResults: userConfig.maxResults,
                    timeMin: userConfig.timeMin,
                    timeMax: userConfig.timeMax
                }
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.gcalendarFetchEvents;
    }
}