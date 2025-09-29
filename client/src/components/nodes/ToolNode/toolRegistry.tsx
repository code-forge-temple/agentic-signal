/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ToolSchema, UserConfigSchema} from "../../../types/ollama.types";
import {Clock, Thunderstorm} from "iconoir-react";
import DuckDuckGo from "../../../assets/duckduckgo.svg";
import Brave from "../../../assets/brave.svg";
import Gmail from "../../../assets/gmail.svg";
import {GraphQLService} from "../../../services/graphqlService";
import {CalendarEventResult, CloudStorageFileResult, EmailResult} from "../../../types/api";
import GoogleDrive from "../../../assets/google-drive.svg";
import GoogleCalendar from "../../../assets/google-calendar.svg";
import {ACCESS_TOKEN_TYPE_OAUTH, PROVIDERS} from "../../../constants";

type ToolDefinition = {
    toolSubtype: string;
    title: string;
    icon: any;
    toolSchema: ToolSchema;
    userConfigSchema: UserConfigSchema;
    handlerFactory: (userConfig: any) => (params: any) => Promise<any>;
};

export const toolRegistry: ToolDefinition[] = [
    {
        toolSubtype: "fetch-weather-data",
        title: "Fetch Weather Data Tool",
        icon: <Thunderstorm />,
        toolSchema: {
            name: "fetchWeatherData",
            description: "Fetches weather data for a given city.",
            parameters: {
                type: "object",
                properties: {
                    city: {type: "string", description: "City name"}
                },
                required: ["city"]
            }
        },
        userConfigSchema: {
            apiKey: {type: "string", description: "WeatherAPI.com API Key"}
        },
        handlerFactory: (userConfig: { apiKey?: string }) => async ({city}: { city: string }) => {
            const response = await fetch(
                `https://api.weatherapi.com/v1/current.json?key=${userConfig.apiKey}&q=${encodeURIComponent(city)}`
            );

            return await response.json();
        },
    },
    {
        toolSubtype: "duckduckgo-search",
        title: "DuckDuckGo Search Tool",
        icon: <DuckDuckGo />,
        toolSchema: {
            name: "duckDuckGoSearch",
            description: "Performs a DuckDuckGo search and returns the top results.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Search query"}
                },
                required: ["query"]
            }
        },
        userConfigSchema: {
            maxResults: {
                type: "integer",
                description: "Maximum number of results to return",
                default: 5,
                minimum: 1,
                maximum: 20
            }
        },
        handlerFactory: (userConfig: { maxResults?: number, browserPath?: string }) => async ({query}: { query: string }) => {
            if (!userConfig.maxResults) {
                return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
            }

            // data received from the LLM needs to be sanitized to avoid issues:
            const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

            try {
                return await GraphQLService.duckDuckGoSearch(sanitizedQuery, {
                    maxResults: userConfig.maxResults,
                    browserPath: userConfig.browserPath
                });
            } catch (error) {
                return {error: error instanceof Error ? error.message : 'Unknown error'};
            }
        },
    },
    {
        toolSubtype: "brave-search",
        title: "Brave Search Tool",
        icon: <Brave />,
        toolSchema: {
            name: "braveSearch",
            description: "Performs a Brave Search using the Brave Search API and returns the top results.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Search query"}
                },
                required: ["query"]
            }
        },
        userConfigSchema: {
            apiKey: {type: "string", description: "Brave Search API Key"},
            maxResults: {
                type: "integer",
                description: "Maximum number of results to return",
                default: 5,
                minimum: 1,
                maximum: 20
            }
        },
        handlerFactory: (userConfig: { apiKey?: string, maxResults?: number }) => async ({query}: { query: string }) => {
            if (!userConfig.apiKey) {
                return {error: "API key must be specified. Please set apiKey in the configuration."};
            }

            if (!userConfig.maxResults) {
                return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
            }

            // data received from the LLM needs to be sanitized to avoid issues:
            const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

            try {
                return await GraphQLService.braveSearch(
                    sanitizedQuery,
                    {
                        apiKey: userConfig.apiKey,
                        maxResults: userConfig.maxResults
                    }
                );
            } catch (error) {
                console.error("Brave Search error:", error);

                return {error: error instanceof Error ? error.message : 'Unknown error'};
            }
        },
    },
    {
        toolSubtype: "date-time-now",
        title: "Date/Time Now Tool",
        icon: <Clock />,
        toolSchema: {
            name: "dateTimeNow",
            description: "Returns the current date and time for a specific city or timezone.",
            parameters: {
                type: "object",
                properties: {
                    city: {
                        type: "string",
                        description: "City name to get the local time for (e.g., 'New York', 'London', 'Tokyo'). Optional - if not provided, returns UTC time."
                    }
                },
                required: []
            }
        },
        userConfigSchema: {},
        handlerFactory: () => async ({city}: {city?: string}) => {
            if (!city) {
                const now = new Date();

                return {
                    iso: now.toISOString(),
                    locale: now.toLocaleString(),
                    unix: Math.floor(now.getTime() / 1000),
                    timezone: "UTC"
                };
            }

            return await GraphQLService.getTimezoneForCity(city);
        },
    },
    {
        toolSubtype: "gmail-fetch-emails",
        title: "Gmail Fetch Emails Tool",
        icon: <Gmail />,
        toolSchema: {
            name: "gmailFetchEmails",
            // eslint-disable-next-line max-len
            description: "Fetches emails from Gmail using Gmail's search query syntax. Use Gmail search operators like: 'in:inbox' (inbox emails), 'from:email@domain.com' (from specific sender), 'to:email@domain.com' (to specific recipient), 'subject:keyword' (subject contains keyword), 'newer_than:7d' (last 7 days), 'older_than:30d' (older than 30 days), 'is:unread' (unread emails), 'has:attachment' (with attachments), 'label:labelname' (with specific label). Combine with AND/OR operators. Examples: 'in:inbox newer_than:7d', 'from:john@example.com OR from:jane@example.com', 'subject:meeting has:attachment'.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        // eslint-disable-next-line max-len
                        description: "Gmail search query using Gmail search operators. Examples: 'in:inbox' (recent inbox emails), 'from:someone@example.com' (emails from specific sender), 'newer_than:7d' (last 7 days), 'subject:meeting' (subject contains 'meeting'), 'is:unread' (unread emails)"
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
                type: ACCESS_TOKEN_TYPE_OAUTH, // This will be rendered as a OAuth2 button + an access token input in the UI
                description: "Gmail Authentication",
                provider: PROVIDERS.GMAIL,
                required: true
            },
            maxResults: {
                type: "integer",
                description: "Maximum number of emails to fetch",
                default: 5,
                minimum: 1,
                maximum: 50
            }
        },
        handlerFactory: (
            userConfig: { accessToken?: string, maxResults?: number }
        ) => async ({query}: { query: string }): Promise<EmailResult[] | { error: string }> => {

            try {
                if (!userConfig.accessToken) {
                    return {error: "Gmail authentication required. Please connect your Gmail account."};
                }

                if (!userConfig.maxResults) {
                    return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
                }

                // data received from the LLM needs to be sanitized to avoid issues:
                const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

                return await GraphQLService.gmailFetchEmails(
                    sanitizedQuery,
                    {
                        accessToken: userConfig.accessToken,
                        maxResults: userConfig.maxResults || 5
                    }
                );
            } catch (error) {
                return {error: error instanceof Error ? error.message : 'Unknown error'};
            }
        }
    },
    {
        toolSubtype: "gdrive-fetch-files",
        title: "Google Drive Fetch Files Tool",
        icon: <GoogleDrive />,
        toolSchema: {
            name: "gdriveFetchFiles",
            // eslint-disable-next-line max-len
            description: "Fetches files from Google Drive using search queries. Use Google Drive search operators like: 'name contains \"filename\"' (search by name), 'name = \"exact filename\"' (exact name match), 'mimeType = \"application/vnd.google-apps.document\"' (Google Docs), 'mimeType = \"application/vnd.google-apps.spreadsheet\"' (Google Sheets), 'mimeType = \"application/vnd.google-apps.presentation\"' (Google Slides), 'mimeType = \"application/pdf\"' (PDF files), 'parents in \"folder_id\"' (files in specific folder), 'modifiedTime > \"2023-01-01\"' (modified after date), 'starred = true' (starred files), 'trashed = false' (not in trash), 'fullText contains \"keyword\"' (search file content).",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        // eslint-disable-next-line max-len
                        description: "Google Drive search query using Google Drive operators. Examples: 'name contains \"report\"', 'name = \"filename\"', 'mimeType = \"application/vnd.google-apps.document\" and starred = true', 'parents in \"folder_id\"', 'fullText contains \"keyword\"'"
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
                description: "Google Drive Authentication",
                provider: PROVIDERS.DRIVE,
                required: true
            },
            maxResults: {
                type: "integer",
                description: "Maximum number of files to fetch",
                default: 5,
                minimum: 1,
                maximum: 100
            }
        },
        handlerFactory: (
            userConfig: { accessToken?: string, maxResults?: number }
        ) => async ({query}: { query: string }): Promise<CloudStorageFileResult[] | { error: string }> => {
            try {
                if (!userConfig.accessToken) {
                    return {error: "Google Drive authentication required. Please connect your Google Drive account."};
                }

                if (!userConfig.maxResults) {
                    return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
                }

                // data received from the LLM needs to be sanitized to avoid issues:
                const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

                return await GraphQLService.gdriveFetchFiles(
                    sanitizedQuery,
                    {
                        accessToken: userConfig.accessToken,
                        maxResults: userConfig.maxResults || 10
                    }
                );
            } catch (error) {
                return {error: error instanceof Error ? error.message : 'Unknown error'};
            }
        }
    },
    {
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
                provider: PROVIDERS.CALENDAR,
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
    }
];