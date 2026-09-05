/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Thunderstorm} from "iconoir-react";
import {ToolDefinition} from "../types";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";
import {sanitizeStringInput} from "../utils/sanitize";
import {FetchWeatherDataToolConfigFields} from "./components/FetchWeatherDataToolConfigFields";
import {UserConfigFields} from "../../UserConfigFields";
import {excludeKeysFromObject} from "../../../../../utils";
import {mapCurrentWeatherResponse, mapForecastWeatherResponse, mapHistoryWeatherResponse} from "./mappers";


export const FetchWeatherDataToolDescriptor:ToolDefinition = {
    toolSubtype: "fetch-weather-data",
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
        apiKey: {type: "string", description: "WeatherAPI.com API Key", required: true}
    }),
    toSanitize: ["userConfig.apiKey"],
    renderConfig: function ({userConfig, onConfigChange}) {
        return (
            <>
                <FetchWeatherDataToolConfigFields
                    userConfig={userConfig}
                    onConfigChange={onConfigChange}
                />
                <UserConfigFields
                    userConfigSchema={excludeKeysFromObject(this.userConfigSchema, ["apiKey"])}
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
            // Determine which endpoint to use based on date
            let endpoint = "current.json";
            let dateParam = "";

            if (date) {
                const requestDate = new Date(date);
                const today = new Date();

                today.setHours(0, 0, 0, 0);
                requestDate.setHours(0, 0, 0, 0);

                const diffTime = requestDate.getTime() - today.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);

                if (diffDays < 0) {
                    // Past date - use history endpoint
                    endpoint = "history.json";
                    dateParam = `&dt=${date}`;
                } else if (diffDays > 0) {
                    // Future date - use forecast endpoint
                    endpoint = "forecast.json";
                    dateParam = `&dt=${date}`;
                }
                // If diffDays === 0 (today), use current endpoint
            }

            const response = await fetch(
                `https://api.weatherapi.com/v1/${endpoint}?key=${userConfig.apiKey}&q=${encodeURIComponent(sanitizedCity)}${dateParam}`
            );

            if (!response.ok) {
                if (response.status === 400) {
                    return {error: `Invalid request. Check city name "${sanitizedCity}" or date format "${date}".`};
                }

                if (response.status === 401) {
                    return {error: "Invalid API key. Please check your WeatherAPI.com API key in the configuration."};
                }

                return {error: `Weather API error: ${response.status} ${response.statusText}`};
            }

            const data = await response.json();

            // Return appropriate data structure based on endpoint
            if (endpoint === "current.json") {
                return mapCurrentWeatherResponse(data);
            } else if (endpoint === "forecast.json") {
                return mapForecastWeatherResponse(data);
            } else if (endpoint === "history.json") {
                return mapHistoryWeatherResponse(data);
            }

            return data;
        } catch (error) {
            console.error("Weather fetch error:", error);

            return {error: error instanceof Error ? error.message : "Failed to fetch weather data"};
        }
    }
};