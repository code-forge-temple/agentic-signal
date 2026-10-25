/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {CalendarEventResult, CalendarEventSearchArgs} from "./types.ts";
import {parseApiResponse} from "../../utils/apiResponse.ts";

const CalendarDateTimeSchema = z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
});

const CalendarPersonSchema = z.object({
    email: z.string(),
    displayName: z.string().optional(),
});

const GoogleCalendarEventSchema = z.object({
    id: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    start: CalendarDateTimeSchema.optional(),
    end: CalendarDateTimeSchema.optional(),
    location: z.string().optional(),
    attendees: z.array(CalendarPersonSchema).optional(),
    creator: CalendarPersonSchema.optional(),
    htmlLink: z.string().optional(),
    status: z.string().optional(),
});

const CalendarEventListSchema = z.object({
    items: z.array(GoogleCalendarEventSchema).optional(),
});

export async function fetchGcalendarEvents (args: CalendarEventSearchArgs): Promise<CalendarEventResult[]> {
    const {query, timeMin, timeMax, maxResults, accessToken} = args;

    try {
        const params = new URLSearchParams({
            timeMin,
            timeMax,
            maxResults: maxResults.toString(),
            singleEvents: "true",
            orderBy: "startTime",
            q: query
        });

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
            {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Google Calendar API failed: ${response.status} ${response.statusText}`);
        }

        const data = parseApiResponse(await response.json(), CalendarEventListSchema, "Google Calendar (events.list)");

        if (!data.items || data.items.length === 0) {
            return [];
        }

        const events: CalendarEventResult[] = data.items.map(event => ({
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
        throw new Error(`Failed to fetch Google Calendar events: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}