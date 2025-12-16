/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimezoneResult} from "./types.ts";


export async function getTimezoneForCity (city: string): Promise<TimezoneResult> {
    try {
        if (!city || city.trim() === "") {
            // Return UTC time if no city is provided
            const now = new Date();

            return {
                iso: now.toISOString(),
                locale: now.toLocaleString(),
                unix: Math.floor(now.getTime() / 1000),
                timezone: "UTC",
                city: "UTC"
            };
        }

        // Example using timeapi.io (replace with your preferred API)
        const response = await fetch(`https://timeapi.io/api/TimeZone/AvailableTimeZones`);

        if (!response.ok) throw new Error(`TimeAPI error: ${response.status}`);

        const timezones = await response.json();
        const cityLower = city.toLowerCase();
        const matchingTimezone = timezones.find((tz: string) =>
            tz.toLowerCase().includes(cityLower) ||
            tz.toLowerCase().includes(cityLower.replace(/\s+/g, '_'))
        );

        if (matchingTimezone) {
            const timeResponse = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(matchingTimezone)}`);

            if (timeResponse.ok) {
                const timeData = await timeResponse.json();

                return {
                    iso: timeData.dateTime,
                    locale: new Date(timeData.dateTime).toLocaleString(),
                    unix: Math.floor(new Date(timeData.dateTime).getTime() / 1000),
                    timezone: matchingTimezone,
                    city: city
                };
            }
        }

        // Fallback to UTC if no timezone found
        const now = new Date();

        return {
            iso: now.toISOString(),
            locale: now.toLocaleString(),
            unix: Math.floor(now.getTime() / 1000),
            timezone: "UTC",
            city: city,
            error: `Could not determine timezone for city: ${city}. Returning UTC time.`
        };
    } catch (error) {
        const now = new Date();

        return {
            iso: now.toISOString(),
            locale: now.toLocaleString(),
            unix: Math.floor(now.getTime() / 1000),
            timezone: "UTC",
            city: city,
            error: `Could not determine timezone for city: ${city}. ${error instanceof Error ? error.message : 'Unknown error'}. Returning UTC time.`
        };
    }
}