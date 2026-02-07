/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import DuckDuckGo from "./assets/duckduckgo.svg";
import {ToolDefinition} from "../types";
import {GraphQLService} from "./services/graphqlService";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";


export const DuckDuckGoSearchToolDescriptor: ToolDefinition = {
    toolSubtype: "duckduckgo-search",
    title: "DuckDuckGo Search Tool",
    icon: <DuckDuckGo />,
    toolSchema: {
        name: "duckDuckGoSearch",
        description: "Performs a DuckDuckGo search and returns the top results.",
        parameters: {
            type: "object",
            properties: {
                query: {type: "string", description: "Search query"}
            },
            required: ["query"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({
        maxResults: {
            type: "integer",
            description: "Maximum number of results to return",
            default: 5,
            minimum: 1,
            maximum: 20
        }
    }),
    toSanitize: [],
    handlerFactory: (userConfig: { maxResults?: number, browserPath?: string }) => async ({query}: { query: string }) => {
        if (!userConfig.maxResults) {
            return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
        }

        if(!query){
            return {error: "`query` tool parameter must be specified"};
        }

        // data received from the LLM needs to be sanitized to avoid issues:
        const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

        try {
            return await GraphQLService.duckDuckGoSearch(sanitizedQuery, {
                maxResults: userConfig.maxResults,
                browserPath: userConfig.browserPath
            });
        } catch (error) {
            return {error: error instanceof Error ? error.message : 'Unknown error'};
        }
    },
};