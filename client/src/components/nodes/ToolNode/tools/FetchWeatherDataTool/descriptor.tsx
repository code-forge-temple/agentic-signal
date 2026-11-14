/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Thunderstorm} from "iconoir-react";
import {ToolDefinition} from "../types";
import {extendSystemUserConfigSchema, ToolError} from "../../../../../types/tool.types";
import {zodIssues} from "../../../../../utils/zodIssues";
import {dayAsWritten} from "../utils/dates";
import {sanitizeStringInput} from "../utils/sanitize";
import {FetchWeatherDataToolConfigFields} from "./components/FetchWeatherDataToolConfigFields";
import {UserConfigFields} from "../../UserConfigFields";
import {excludeKeysFromObject, localIsoDay} from "../../../../../utils";
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

// What small models put in an optional date when they mean none (blank too): the current weather.
const NO_DATE = /^(?:|today|now|current|none|null|undefined)$/i;

/** The endpoint to ask, and the day to send it as YYYY-MM-DD (none for the current weather). */
type WeatherRequest = {endpoint: WeatherEndpoint; day?: string};

/**
 * What to ask for `date`: the history of a day before today, the forecast for a day after it, the current weather for
 * today and for no date (or a word for none: today, now, none). The day sent is the one the date names as written (see
 * dayAsWritten). An error for text that isn't a date, so the LLM can send another, not today's weather as if it were
 * an answer.
 */
function weatherRequest (date: string | undefined): WeatherRequest | ToolError {
    if (date === undefined || NO_DATE.test(String(date).trim())) return {endpoint: "current.json"};

    const requestDate = dayAsWritten(String(date));

    if (!requestDate) return {error: `\`date\` tool parameter "${date}" is not a date: send it as YYYY-MM-DD`};

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const fromToday = requestDate.getTime() - today.getTime();

    if (fromToday === 0) return {endpoint: "current.json"};

    return {endpoint: fromToday < 0 ? "history.json" : "forecast.json", day: localIsoDay(requestDate)};
}

/** The error for a request WeatherAPI.com turned down; it names the day only when one was sent. */
function weatherApiError (response: Response, city: string, day: string | undefined): ToolError {
    if (response.status === 400 && !day) return {error: `Invalid request. Check city name "${city}".`};

    if (response.status === 400) return {error: `Invalid request. Check city name "${city}" or date "${day}".`};

    if (response.status === 401) return {error: "Invalid API key. Please check your WeatherAPI.com API key in the configuration."};

    return {error: `Weather API error: ${response.status} ${response.statusText}`};
}

/** The answer trimmed for the LLM, or an error when it isn't shaped as expected. */
async function readWeather (response: Response, endpoint: WeatherEndpoint) {
    const parsed = WeatherApiResponseSchema.safeParse(await response.json());

    if (!parsed.success) return {error: `Unexpected response from WeatherAPI.com (${zodIssues(parsed.error)})`};

    return WEATHER_MAPPERS[endpoint](parsed.data);
}

/** The weather in `city` for `date` (today when there's none), from WeatherAPI.com. */
async function fetchWeather (apiKey: string, city: string, date: string | undefined) {
    const request = weatherRequest(date);

    if ("error" in request) return request;

    const {endpoint, day} = request;
    const dayParam = day ? `&dt=${day}` : "";
    const response = await fetch(`https://api.weatherapi.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city)}${dayParam}`);

    if (!response.ok) return weatherApiError(response, city, day);

    return readWeather(response, endpoint);
}