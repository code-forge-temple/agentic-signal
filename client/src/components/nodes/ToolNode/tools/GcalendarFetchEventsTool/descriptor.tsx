/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import GoogleCalendar from "./assets/google-calendar.svg";
import {ToolDefinition} from "../types";
import {GraphQLService} from "./services/graphqlService";
import {CalendarEventResult} from "@shared/types.gen";
import {sanitizeStringInput} from "../utils/sanitize";
import {googleTool} from "../utils/google/googleTool";


const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** `value` as an ISO time when it reads as a date, else `fallback`'s. */
const isoTimeOr = (value: string | undefined, fallback: Date) => {
    const time = value ? new Date(value) : fallback;

    return (isNaN(time.getTime()) ? fallback : time).toISOString();
};

export const GcalendarFetchEventsToolDescriptor: ToolDefinition = googleTool<{query: string; timeMin?: string; timeMax?: string}, CalendarEventResult[]>({
    toolSubtype: "gcalendar-fetch-events",
    title: "Google Calendar Fetch Events Tool",
    icon: <GoogleCalendar />,
    service: "Google Calendar",
    scope: "calendar.readonly",
    maxResults: {items: "events", maximum: 250},
    toolSchema: {
        name: "gcalendarFetchEvents",
        // eslint-disable-next-line max-len
        description: "Fetches events from Google Calendar within a specified date range. You can search for specific events by providing a text query, or fetch all events by using an empty string for the query parameter. The tool requires a query parameter (can be empty string) and automatically sets time range to next 30 days if not specified.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "Text search query to find events by summary or description. Use empty string \"\" to fetch all events in the date range. Examples: \"meeting\", \"lunch\", \"appointment\", \"\" (for all events)"
                },
                timeMin: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "Optional: Lower bound (inclusive) for event start time in ISO 8601 format (e.g., '2024-01-01T00:00:00Z'). If not provided, defaults to current time."
                },
                timeMax: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "Optional: Upper bound (exclusive) for event start time in ISO 8601 format (e.g., '2024-12-31T23:59:59Z'). If not provided, defaults to 30 days from now."
                }
            },
            required: ["query"]
        }
    },
    // An empty query is a valid input: it fetches every event in the range. What the LLM sends is sanitized before use.
    fetch: async ({query, timeMin, timeMax}, auth) => GraphQLService.gcalendarFetchEvents(sanitizeStringInput(query || ""), {
        timeMin: isoTimeOr(timeMin, new Date()),
        timeMax: isoTimeOr(timeMax, new Date(Date.now() + THIRTY_DAYS_MS)),
        ...auth,
    }),
});
