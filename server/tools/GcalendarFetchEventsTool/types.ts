/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const CalendarEventResultFields = {
    id: 'String!',
    summary: 'String',
    description: 'String',
    start: 'CalendarDateTime',
    end: 'CalendarDateTime',
    location: 'String',
    attendees: '[CalendarAttendee]',
    creator: 'CalendarPerson',
    htmlLink: 'String',
    status: 'String'
} as const;

export const CalendarDateTimeFields = {
    dateTime: 'String',
    date: 'String',
    timeZone: 'String'
} as const;

export const CalendarAttendeeFields = {
    email: 'String!',
    displayName: 'String'
} as const;

export const CalendarPersonFields = {
    email: 'String!',
    displayName: 'String'
} as const;

export interface CalendarEventResult {
    id: string;
    summary?: string;
    description?: string;
    start?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    end?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    location?: string;
    attendees?: { email: string; displayName?: string }[];
    creator?: { email: string; displayName?: string };
    htmlLink?: string;
    status?: string;
}

export interface CalendarEventSearchArgs {
    query: string;
    timeMin: string;
    timeMax: string;
    maxResults: number;
    accessToken: string;
}