/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Thunderstorm} from "iconoir-react";
import {ToolDefinition} from "../types";
import {extendSystemUserConfigSchema, ToolError} from "../../../../../types/ollama.types";
import {sanitizeStringInput} from "../utils/sanitize";
import {FetchWeatherDataToolConfigFields} from "./components/FetchWeatherDataToolConfigFields";
import {UserConfigFields} from "../../UserConfigFields";
import {excludeKeysFromObject} from "../../../../../utils";
import {GLOBAL_SECRETS, LOCAL_SECRETS, TOOL_SUBTYPE} from "./constants";
import {mapCurrentWeatherResponse, mapForecastWeatherResponse, mapHistoryWeatherResponse, WeatherApiResponse, WeatherApiResponseSchema} from "./mappers";


export const FetchWeatherDataToolDescriptor:ToolDefinition = {
    toolSubtype: TOOL_SUBTYPE,
    title: "Fetch Weather Data Tool",
    icon: <Thunderstorm />,
    toolSchema: {
        name: "fetchWeatherData",
        description: "Fetches weather data for a given city. Supports current weather, historical weather (past dates), and weather forecast (future dates).",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "City name (e.g., 'New York', 'London', 'Tokyo'). Can include country for disambiguation (e.g., 'Paris, France')"
                },
                date: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "Optional date in YYYY-MM-DD format. If not provided, returns current weather. For past dates (up to 7 days back), returns historical weather. For future dates (up to 14 days ahead), returns weather forecast."
                }
            },
            required: ["city"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({
        [LOCAL_SECRETS.API_KEY]: {type: "string", description: "WeatherAPI.com API Key", required: true}
    }),
    globalSecrets: Object.values(GLOBAL_SECRETS),
    toSanitize: Object.values(LOCAL_SECRETS).map(field => `userConfig.${field}`),
    renderConfig: function ({userConfig, onConfigChange}) {
        return (
            <>
                <FetchWeatherDataToolConfigFields
                    userConfig={userConfig}
                    onConfigChange={onConfigChange}
                />
                <UserConfigFields
                    userConfigSchema={excludeKeysFromObject(this.userConfigSchema, Object.values(LOCAL_SECRETS))}
                    userConfig={userConfig}
                    onConfigChange={onConfigChange}
                />
            </>
        );
    },
    handlerFactory: (userConfig: { apiKey?: string }) => async ({city, date}: { city: string, date?: string }) => {
        if (!userConfig.apiKey) {
            return {error: "API key must be specified. Please set apiKey in the configuration."};
        }

        if(!city || String(city).trim() === ""){
            return {error: "`city` tool parameter must be specified"};
        }

        const sanitizedCity = sanitizeStringInput(city);

        try {
            return await fetchWeather(userConfig.apiKey, sanitizedCity, date);
        } catch (error) {
            console.error("Weather fetch error:", error);

            return {error: error instanceof Error ? error.message : "Failed to fetch weather data"};
        }
    }
};

type WeatherEndpoint = "current.json" | "forecast.json" | "history.json";

/** What each endpoint's answer is trimmed to for the LLM. */
const WEATHER_MAPPERS: Record<WeatherEndpoint, (data: WeatherApiResponse) => unknown> = {
    "current.json": mapCurrentWeatherResponse,
    "forecast.json": mapForecastWeatherResponse,
    "history.json": mapHistoryWeatherResponse,
};

/**
 * The day `date` names, here. JavaScript reads a bare YYYY-MM-DD as midnight UTC, which west of UTC is the evening
 * before: tomorrow would count as today, and today as yesterday. Anything else (an impossible day such as 2026-13-45
 * included) is read as JavaScript reads it.
 */
function localDay (date: string): Date {
    const [, year, month, day] = (/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim()) ?? []).map(Number);
    const local = new Date(year, month - 1, day);

    return local.getMonth() === month - 1 && local.getDate() === day ? local : new Date(date);
}

/**
 * The endpoint that answers for `date`: history for a day before today, forecast for a day after it, and current
 * weather for today, for no date, and for a date that can't be read.
 */
function weatherEndpoint (date: string | undefined): {endpoint: WeatherEndpoint; dateParam: string} {
    const current = {endpoint: "current.json", dateParam: ""} as const;

    if (!date) return current;

    const requestDate = localDay(date);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    requestDate.setHours(0, 0, 0, 0);

    const fromToday = requestDate.getTime() - today.getTime();

    if (fromToday < 0) return {endpoint: "history.json", dateParam: `&dt=${date}`};

    if (fromToday > 0) return {endpoint: "forecast.json", dateParam: `&dt=${date}`};

    return current;
}

/** The error for a request WeatherAPI.com turned down. */
function weatherApiError (response: Response, city: string, date: string | undefined): ToolError {
    if (response.status === 400) return {error: `Invalid request. Check city name "${city}" or date format "${date}".`};

    if (response.status === 401) return {error: "Invalid API key. Please check your WeatherAPI.com API key in the configuration."};

    return {error: `Weather API error: ${response.status} ${response.statusText}`};
}

/** The answer trimmed for the LLM, or an error when it isn't shaped as expected. */
async function readWeather (response: Response, endpoint: WeatherEndpoint) {
    const parsed = WeatherApiResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
        const issues = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");

        return {error: `Unexpected response from WeatherAPI.com (${issues})`};
    }

    return WEATHER_MAPPERS[endpoint](parsed.data);
}

/** The weather in `city` for `date` (today when there's none), from WeatherAPI.com. */
async function fetchWeather (apiKey: string, city: string, date: string | undefined) {
    const {endpoint, dateParam} = weatherEndpoint(date);
    const response = await fetch(`https://api.weatherapi.com/v1/${endpoint}?key=${apiKey}&q=${encodeURIComponent(city)}${dateParam}`);

    if (!response.ok) return weatherApiError(response, city, date);

    return readWeather(response, endpoint);
}