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

type ForecastDay = NonNullable<NonNullable<WeatherApiResponse["forecast"]>["forecastday"]>[number];

/** The place the answer is for. */
function placeOf ({location}: WeatherApiResponse) {
    const {name, region, country}: NonNullable<WeatherApiResponse["location"]> = location ?? {};

    return {name, region, country};
}

/** The place, with its local time. */
const locationOf = (data: WeatherApiResponse) => ({...placeOf(data), localtime: data.location?.localtime});

/** The day asked about: the first (and only) day of a forecast or history answer. */
const forecastDayOf = (data: WeatherApiResponse): ForecastDay | undefined => data.forecast?.forecastday?.[0];

/** The fields of a forecast or history day the LLM gets (a forecast adds the uv index). */
function dayFields ({date, day}: ForecastDay) {
    const {maxtemp_c, maxtemp_f, mintemp_c, mintemp_f, condition, avghumidity, maxwind_kph, maxwind_mph}: NonNullable<ForecastDay["day"]> = day ?? {};

    return {date, maxtemp_c, maxtemp_f, mintemp_c, mintemp_f, condition: condition?.text, avghumidity, maxwind_kph, maxwind_mph};
}

export function mapCurrentWeatherResponse (data: WeatherApiResponse) {
    const {temp_c, temp_f, condition, wind_kph, wind_mph, wind_dir, humidity, feelslike_c, feelslike_f, uv}: NonNullable<WeatherApiResponse["current"]> = data.current ?? {};

    return {
        location: locationOf(data),
        current: {temp_c, temp_f, condition: condition?.text, wind_kph, wind_mph, wind_dir, humidity, feelslike_c, feelslike_f, uv},
    };
}

export function mapForecastWeatherResponse (data: WeatherApiResponse) {
    const forecastDay = forecastDayOf(data);

    return {
        location: locationOf(data),
        forecast: forecastDay ? {...dayFields(forecastDay), uv: forecastDay.day?.uv} : null,
    };
}

export function mapHistoryWeatherResponse (data: WeatherApiResponse) {
    const forecastDay = forecastDayOf(data);

    return {
        location: placeOf(data),
        history: forecastDay ? dayFields(forecastDay) : null,
    };
}
