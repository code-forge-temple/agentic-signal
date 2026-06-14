/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import WebIcon from "./assets/web.svg";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";
import {isTauri} from "../../../../../utils";


export const WebPageToMarkdownToolDescriptor: ToolDefinition = {
    toolSubtype: "web-page-to-markdown",
    title: "Web Page to Markdown Tool",
    icon: <WebIcon />,
    toolSchema: {
        name: "webPageToMarkdown",
        // eslint-disable-next-line max-len
        description: "Fetches one or more web pages by URL, extracts the main article content (stripping ads and navigation), and returns an array of results each containing the page title, URL, Markdown content, and a short excerpt.",
        parameters: {
            type: "object",
            properties: {
                urls: {type: "array", items: {type: "string"}, description: "One or more full URLs of web pages to fetch and convert to Markdown"}
            },
            required: ["urls"]
        }
    },
    userConfigSchema: extendSystemUserConfigSchema({}),
    toSanitize: [],
    handlerFactory: (userConfig: { browserPath?: string }) => async ({urls}: { urls: string[] }) => {
        if (!userConfig.browserPath && isTauri()) {
            return {error: "Browser executable path must be specified. Please set Browser Executable Path in the app Settings."};
        }

        if (!urls || urls.length === 0) {
            return {error: "`urls` tool parameter must be specified"};
        }

        // Sanitize URLs received from LLM to strip smart quotes
        const sanitizedUrls = urls.map(u => String(u).replace(/["""]/g, '"').replace(/[''']/g, "'").trim());

        try {
            return await GraphQLService.webPageToMarkdown(sanitizedUrls, {
                browserPath: userConfig.browserPath
            });
        } catch (error) {
            console.error("WebPageToMarkdown error:", error);

            return {error: error instanceof Error ? error.message : 'Unknown error'};
        }
    },
};
