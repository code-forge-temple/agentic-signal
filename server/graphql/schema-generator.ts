/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {
    EmailResultFields,
    SearchResultFields,
    BraveResultFields,
    CloudStorageFileResultFields,
    CalendarEventResultFields,
    CalendarDateTimeFields,
    CalendarAttendeeFields,
    CalendarPersonFields,
    TimezoneResultFields
} from '../../shared/types/index.ts';

function generateGraphQLType (name: string, fields: Record<string, string>): string {
    const fieldDefs = Object.entries(fields)
        .map(([key, type]) => `    ${key}: ${type}`)
        .join('\n');

    return `  type ${name} {\n${fieldDefs}\n  }`;
}

export function generateTypeDefs (): string {
    return /* GraphQL */ `
    ${generateGraphQLType("DuckDuckGoResult", SearchResultFields)}
    
    ${generateGraphQLType("BraveResult", BraveResultFields)}

    ${generateGraphQLType("EmailResult", EmailResultFields)}

    ${generateGraphQLType("CloudStorageFileResult", CloudStorageFileResultFields)}

    ${generateGraphQLType("CalendarEventResult", CalendarEventResultFields)}

    ${generateGraphQLType("CalendarDateTime", CalendarDateTimeFields)}

    ${generateGraphQLType("CalendarAttendee", CalendarAttendeeFields)}

    ${generateGraphQLType("CalendarPerson", CalendarPersonFields)}

    ${generateGraphQLType("TimezoneResult", TimezoneResultFields)}

    type Query {
        renderHtml(url: String!, browserPath: String): String
        duckDuckGoSearch(query: String!, maxResults: Int, browserPath: String): [DuckDuckGoResult]
        braveSearch(query: String!, maxResults: Int): [BraveResult]
        gmailFetchEmails(query: String!, maxResults: Int!): [EmailResult]
        gdriveFetchFiles(query: String!, maxResults: Int!): [CloudStorageFileResult]
        gcalendarFetchEvents(query: String!, maxResults: Int!, timeMin: String!, timeMax: String!): [CalendarEventResult]
        getTimezoneForCity(city: String!): TimezoneResult
    }
  `;
}