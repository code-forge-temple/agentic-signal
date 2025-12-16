/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType, cleanTypeDefs} from "../../utils/graphqlUtils.ts";
import {CalendarAttendeeFields, CalendarDateTimeFields, CalendarEventResultFields, CalendarPersonFields} from "./types.ts";


export const graphqlMethodName = "gcalendarFetchEvents";

export const graphqlResultTypeName = "CalendarEventResult"

export const typeDefs = cleanTypeDefs(`
    ${generateGraphQLType("CalendarEventResult", CalendarEventResultFields)}

    ${generateGraphQLType("CalendarDateTime", CalendarDateTimeFields)}

    ${generateGraphQLType("CalendarAttendee", CalendarAttendeeFields)}

    ${generateGraphQLType("CalendarPerson", CalendarPersonFields)}
`);

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(query: String!, maxResults: Int!, timeMin: String!, timeMax: String!): [${graphqlResultTypeName}]`;