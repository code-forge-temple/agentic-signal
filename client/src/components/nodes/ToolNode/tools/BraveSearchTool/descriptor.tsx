/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import Brave from "./assets/brave.svg";


export const BraveSearchToolDescriptor:ToolDefinition = {
    toolSubtype: "brave-search",
    title: "Brave Search Tool",
    icon: <Brave />,
    toolSchema: {
        name: "braveSearch",
        description: "Performs a Brave Search using the Brave Search API and returns the top results.",
        parameters: {
            type: "object",
            properties: {
                query: {type: "string", description: "Search query"}
            },
            required: ["query"]
        }
    },
    userConfigSchema: {
        apiKey: {type: "string", description: "Brave Search API Key", required: true},
        maxResults: {
            type: "integer",
            description: "Maximum number of results to return",
            default: 5,
            minimum: 1,
            maximum: 20
        }
    },
    toSanitize: [],
    handlerFactory: (userConfig: { apiKey?: string, maxResults?: number }) => async ({query}: { query: string }) => {
        if (!userConfig.apiKey) {
            return {error: "API key must be specified. Please set apiKey in the configuration."};
        }

        if (!userConfig.maxResults) {
            return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
        }

        // data received from the LLM needs to be sanitized to avoid issues:
        const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

        try {
            return await GraphQLService.braveSearch(
                sanitizedQuery,
                {
                    apiKey: userConfig.apiKey,
                    maxResults: userConfig.maxResults
                }
            );
        } catch (error) {
            console.error("Brave Search error:", error);

            return {error: error instanceof Error ? error.message : 'Unknown error'};
        }
    },
};