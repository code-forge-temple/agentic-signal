/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BraveResult, CalendarEventResult, CloudStorageFileResult, DuckDuckGoResult, EmailResult} from '../types/api.ts';
import {BACKEND_PORT} from '@shared/constants.ts';

export class GraphQLService {
    private static baseUrl =
        import.meta.env.PROD
            ? `http://localhost:${BACKEND_PORT}/graphql`
            : "/graphql";

    static async duckDuckGoSearch (query: string, userConfig: { maxResults: number, browserPath?: string }): Promise<DuckDuckGoResult[]> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int, $browserPath: String) {
                        duckDuckGoSearch(query: $query, maxResults: $maxResults, browserPath: $browserPath) {
                            sourceAndUrl
                            title
                            description
                            url
                        }
                    }
                `,
                variables: {query, maxResults: userConfig.maxResults, browserPath: userConfig.browserPath}
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.duckDuckGoSearch;
    }

    static async braveSearch (query: string, userConfig: { apiKey: string, maxResults: number }): Promise<BraveResult[]> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userConfig.apiKey}`
                },
                body: JSON.stringify({
                    query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int) {
                        braveSearch(query: $query, maxResults: $maxResults) {
                            title
                            url
                            description
                        }
                    }
                `,
                    variables: {query, maxResults: userConfig.maxResults}
                })
            });

            const {data, errors} = await response.json();

            if (errors) {
                throw new Error(errors.map((e: any) => e.message).join('\n'));
            }

            return data.braveSearch;
        } catch (error) {
            console.error("Brave Search error:", error);
            throw new Error(error instanceof Error ? error.message : 'Unknown error');
        }
    }

    static async renderHtml (url: string, browserPath?: string): Promise<string> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($url: String!, $browserPath: String) {
                        renderHtml(url: $url, browserPath: $browserPath)
                    }
                `,
                variables: {url, browserPath}
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        if (!data.renderHtml) {
            throw new Error("No HTML returned from backend");
        }

        return data.renderHtml;
    }

    static async gmailFetchEmails (query: string, userConfig: { accessToken: string, maxResults: number }): Promise<EmailResult[]> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userConfig.accessToken}`
            },
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int!) {
                        gmailFetchEmails(query: $query, maxResults: $maxResults) {
                            id
                            subject
                            from
                            date
                        }
                    }
                `,
                variables: {
                    query,
                    maxResults: userConfig.maxResults
                }
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.gmailFetchEmails;
    }

    static async gdriveFetchFiles (query: string, userConfig: { accessToken: string, maxResults: number }): Promise<CloudStorageFileResult[]> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userConfig.accessToken}`
            },
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($query: String!, $maxResults: Int!) {
                        gdriveFetchFiles(query: $query, maxResults: $maxResults) {
                            id
                            name
                            mimeType
                            webViewLink
                            modifiedTime
                            size
                            owners
                            content
                        }
                    }
                `,
                variables: {
                    query,
                    maxResults: userConfig.maxResults
                }
            })
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.gdriveFetchFiles;
    }

    static async gcalendarFetchEvents (
        query: string,
        userConfig: {
            accessToken: string,
            maxResults: number,
            timeMin: string,
            timeMax: string,
        }): Promise<CalendarEventResult[]> {
        const response = await fetch(this.baseUrl, {
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

    static async getTimezoneForCity (city: string): Promise<{ iso: string, locale: string, unix: number, timezone: string, city: string, utc_offset?: string, error?: string }> {
        const response = await fetch(this.baseUrl, {
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