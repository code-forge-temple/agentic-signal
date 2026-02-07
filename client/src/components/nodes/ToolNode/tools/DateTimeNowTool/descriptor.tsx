/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Clock} from "iconoir-react";
import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";


export const DateTimeNowToolDescriptor:ToolDefinition = {
    toolSubtype: "date-time-now",
    title: "Date/Time Now Tool",
    icon: <Clock />,
    toolSchema: {
        name: "dateTimeNow",
        description: "Returns the current date and time for a specific city. Do not use timezone abbreviations like UTC or EST - use actual city names.",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "The name of a city (e.g., 'New York', 'London', 'Tokyo'). Use actual city names only, NOT timezone codes like 'UTC' or 'EST'. If omitted, returns the current UTC time."
                }
            },
            required: []
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({}),
    toSanitize: [],
    handlerFactory: () => async ({city}: {city?: string}) => {
        if (!city || String(city).trim() === "") {
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
};