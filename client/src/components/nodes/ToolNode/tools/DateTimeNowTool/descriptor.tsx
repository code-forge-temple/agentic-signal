/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Clock} from "iconoir-react";
import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";


export const DateTimeNowToolDescriptor:ToolDefinition = {
    toolSubtype: "date-time-now",
    title: "Date/Time Now Tool",
    icon: <Clock />,
    toolSchema: {
        name: "dateTimeNow",
        description: "Returns the current date and time for a specific city or timezone.",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "City name to get the local time for (e.g., 'New York', 'London', 'Tokyo'). Optional - if not provided, returns UTC time."
                }
            },
            required: []
        }
    },
    userConfigSchema: {},
    toSanitize: [],
    handlerFactory: () => async ({city}: {city?: string}) => {
        if (!city) {
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