/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CalendarEventResult, CalendarEventSearchArgs} from '../../shared/types/calendar.ts';

type GoogleCalendarEvent = {
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
    attendees?: Array<{
        email: string;
        displayName?: string;
    }>;
    creator?: {
        email: string;
        displayName?: string;
    };
    htmlLink?: string;
    status?: string;
};

export async function fetchGcalendarEvents (args: CalendarEventSearchArgs): Promise<CalendarEventResult[]> {
    const {query, timeMin, timeMax, maxResults, accessToken} = args;

    console.log('=== fetchGcalendarEvents Debug Start ===');
    console.log('Input args:', {
        query,
        timeMin,
        timeMax,
        maxResults,
        accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : 'MISSING'
    });

    try {
        // Build the Google Calendar API URL with parameters
        const params = new URLSearchParams({
            timeMin,
            timeMax,
            maxResults: maxResults.toString(),
            singleEvents: 'true',
            orderBy: 'startTime',
            q: query
        });

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));


        if (!response.ok) {
            console.log(`Google Calendar API failed: ${response.status} ${response.statusText}`);

            throw new Error(`Google Calendar API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return [];
        }

        // Transform Google Calendar events to our CalendarEventResult format
        const events: CalendarEventResult[] = data.items.map((event: GoogleCalendarEvent) => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start,
            end: event.end,
            location: event.location,
            attendees: event.attendees?.map(attendee => ({
                email: attendee.email,
                displayName: attendee.displayName
            })),
            creator: event.creator ? {
                email: event.creator.email,
                displayName: event.creator.displayName
            } : undefined,
            htmlLink: event.htmlLink,
            status: event.status
        }));

        return events;

    } catch (error) {
        throw new Error(`Failed to fetch Google Calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}