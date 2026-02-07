/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TimezoneResult} from "./types.ts";
import ct from "npm:city-timezones";

export async function getTimezoneForCity (city: string): Promise<TimezoneResult> {
    try {
        const cityData = ct.lookupViaCity(city);

        if (cityData && cityData.length > 0) {
            const timezone = cityData[0].timezone;
            const now = new Date();

            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZoneName: 'shortOffset'
            });

            const parts = formatter.formatToParts(now);
            const offset = parts.find(p => p.type === 'timeZoneName')?.value;

            return {
                iso: now.toISOString(),
                locale: formatter.format(now),
                unix: Math.floor(now.getTime() / 1000),
                timezone: timezone,
                city: city,
                utc_offset: offset || undefined
            };
        }

        const now = new Date();

        return {
            iso: now.toISOString(),
            locale: now.toLocaleString(),
            unix: Math.floor(now.getTime() / 1000),
            timezone: "UTC",
            city: city,
            utc_offset: undefined,
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
            utc_offset: undefined,
            error: `Could not determine timezone for city: ${city}. ${error instanceof Error ? error.message : 'Unknown error'}. Returning UTC time.`
        };
    }
}