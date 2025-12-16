/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import GoogleCalendar from "./assets/google-calendar.svg";
import {ToolDefinition} from "../types";
import {GraphQLService} from "./services/graphqlService";
import {CalendarEventResult} from "@shared/types.gen";
import {OAUTH_PROVIDER, OAUTH_PROVIDER_SCOPE, oauthHandler} from "./constants";
import {ACCESS_TOKEN_TYPE_OAUTH} from "../utils/oauth";


export const GcalendarFetchEventsToolDescriptor:ToolDefinition = {
    toolSubtype: "gcalendar-fetch-events",
    title: "Google Calendar Fetch Events Tool",
    icon: <GoogleCalendar />,
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
    userConfigSchema: {
        googleClientId: {
            type: "string",
            description: "Google OAuth2 Client ID (from Google Cloud Console)"
        },
        accessToken: {
            type: ACCESS_TOKEN_TYPE_OAUTH,
            description: "Google Calendar Authentication",
            provider: OAUTH_PROVIDER,
            scope: OAUTH_PROVIDER_SCOPE,
            oauthHandler,
            required: true
        },
        maxResults: {
            type: "integer",
            description: "Maximum number of events to fetch",
            default: 5,
            minimum: 1,
            maximum: 250
        }
    },
    toSanitize: ["userConfig.accessToken"],
    handlerFactory: (
        userConfig: { accessToken?: string, maxResults?: number }
    ) => async ({query, timeMin, timeMax}: {
            query: string,
            timeMin?: string,
            timeMax?: string,
        }): Promise<CalendarEventResult[] | { error: string }> => {
        try {
            if (!userConfig.accessToken) {
                return {error: "Google Calendar authentication required. Please connect your Google Calendar account."};
            }

            if (!userConfig.maxResults) {
                return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
            }

            // data received from the LLM needs to be sanitized to avoid issues:
            const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");
            const sanitizedTimeMin = timeMin && !isNaN(new Date(timeMin).getTime()) ?
                new Date(timeMin).toISOString() :
                new Date().toISOString();
            const sanitizedTimeMax = timeMax && !isNaN(new Date(timeMax).getTime()) ?
                new Date(timeMax).toISOString() :
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now


            return await GraphQLService.gcalendarFetchEvents(
                sanitizedQuery,
                {
                    timeMin: sanitizedTimeMin,
                    timeMax: sanitizedTimeMax,
                    maxResults: userConfig.maxResults,
                    accessToken: userConfig.accessToken
                }
            );
        } catch (error) {
            return {error: error instanceof Error ? error.message : 'Unknown error'};
        }
    }
};