/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';


// WeatherAPI.com's raw responses carry a lot more than this tool needs (astro data, air
// quality, alerts, multi-day arrays, etc.) — these mappers trim each endpoint's response
// down to just the fields relevant to the LLM, using optional chaining since none of it
// is guaranteed present.

// Every field is optional and nullable, so the schema checks the types of what the mappers
// read without rejecting a response that merely leaves something out.
const optionalNumber = z.number().nullish();
const optionalString = z.string().nullish();
const WeatherConditionSchema = z.object({text: optionalString}).nullish();

export const WeatherApiResponseSchema = z.object({
    location: z.object({
        name: optionalString,
        region: optionalString,
        country: optionalString,
        localtime: optionalString
    }).nullish(),
    current: z.object({
        temp_c: optionalNumber,
        temp_f: optionalNumber,
        condition: WeatherConditionSchema,
        wind_kph: optionalNumber,
        wind_mph: optionalNumber,
        wind_dir: optionalString,
        humidity: optionalNumber,
        feelslike_c: optionalNumber,
        feelslike_f: optionalNumber,
        uv: optionalNumber
    }).nullish(),
    forecast: z.object({
        forecastday: z.array(z.object({
            date: optionalString,
            day: z.object({
                maxtemp_c: optionalNumber,
                maxtemp_f: optionalNumber,
                mintemp_c: optionalNumber,
                mintemp_f: optionalNumber,
                condition: WeatherConditionSchema,
                avghumidity: optionalNumber,
                maxwind_kph: optionalNumber,
                maxwind_mph: optionalNumber,
                uv: optionalNumber
            }).nullish()
        })).nullish()
    }).nullish()
});

export type WeatherApiResponse = z.infer<typeof WeatherApiResponseSchema>;

export function mapCurrentWeatherResponse (data: WeatherApiResponse) {
    return {
        location: {
            name: data.location?.name,
            region: data.location?.region,
            country: data.location?.country,
            localtime: data.location?.localtime
        },
        current: {
            temp_c: data.current?.temp_c,
            temp_f: data.current?.temp_f,
            condition: data.current?.condition?.text,
            wind_kph: data.current?.wind_kph,
            wind_mph: data.current?.wind_mph,
            wind_dir: data.current?.wind_dir,
            humidity: data.current?.humidity,
            feelslike_c: data.current?.feelslike_c,
            feelslike_f: data.current?.feelslike_f,
            uv: data.current?.uv
        }
    };
}

export function mapForecastWeatherResponse (data: WeatherApiResponse) {
    return {
        location: {
            name: data.location?.name,
            region: data.location?.region,
            country: data.location?.country,
            localtime: data.location?.localtime
        },
        forecast: data.forecast?.forecastday?.[0] ? {
            date: data.forecast.forecastday[0].date,
            maxtemp_c: data.forecast.forecastday[0].day?.maxtemp_c,
            maxtemp_f: data.forecast.forecastday[0].day?.maxtemp_f,
            mintemp_c: data.forecast.forecastday[0].day?.mintemp_c,
            mintemp_f: data.forecast.forecastday[0].day?.mintemp_f,
            condition: data.forecast.forecastday[0].day?.condition?.text,
            avghumidity: data.forecast.forecastday[0].day?.avghumidity,
            maxwind_kph: data.forecast.forecastday[0].day?.maxwind_kph,
            maxwind_mph: data.forecast.forecastday[0].day?.maxwind_mph,
            uv: data.forecast.forecastday[0].day?.uv
        } : null
    };
}

export function mapHistoryWeatherResponse (data: WeatherApiResponse) {
    return {
        location: {
            name: data.location?.name,
            region: data.location?.region,
            country: data.location?.country
        },
        history: data.forecast?.forecastday?.[0] ? {
            date: data.forecast.forecastday[0].date,
            maxtemp_c: data.forecast.forecastday[0].day?.maxtemp_c,
            maxtemp_f: data.forecast.forecastday[0].day?.maxtemp_f,
            mintemp_c: data.forecast.forecastday[0].day?.mintemp_c,
            mintemp_f: data.forecast.forecastday[0].day?.mintemp_f,
            condition: data.forecast.forecastday[0].day?.condition?.text,
            avghumidity: data.forecast.forecastday[0].day?.avghumidity,
            maxwind_kph: data.forecast.forecastday[0].day?.maxwind_kph,
            maxwind_mph: data.forecast.forecastday[0].day?.maxwind_mph
        } : null
    };
}
