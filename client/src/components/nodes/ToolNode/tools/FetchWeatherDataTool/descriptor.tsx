/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Thunderstorm} from "iconoir-react";
import {ToolDefinition} from "../types";


export const FetchWeatherDataToolDescriptor:ToolDefinition = {
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
        apiKey: {type: "string", description: "WeatherAPI.com API Key", required: true}
    },
    toSanitize: [],
    handlerFactory: (userConfig: { apiKey?: string }) => async ({city}: { city: string }) => {
        const response = await fetch(
            `https://api.weatherapi.com/v1/current.json?key=${userConfig.apiKey}&q=${encodeURIComponent(city)}`
        );

        return await response.json();
    }
};