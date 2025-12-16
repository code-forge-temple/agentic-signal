/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import GoogleDrive from "./assets/google-drive.svg";
import {OAUTH_PROVIDER, OAUTH_PROVIDER_SCOPE, oauthHandler} from "./constants";
import {CloudStorageFileResult} from "@shared/types.gen";
import {ACCESS_TOKEN_TYPE_OAUTH} from "../utils/oauth";


export const GdriveFetchFilesToolDescriptor:ToolDefinition = {
    toolSubtype: "gdrive-fetch-files",
    title: "Google Drive Fetch Files Tool",
    icon: <GoogleDrive />,
    toolSchema: {
        name: "gdriveFetchFiles",
        // eslint-disable-next-line max-len
        description: "Fetches files from Google Drive using search queries. Use Google Drive search operators like: 'name contains \"filename\"' (search by name), 'name = \"exact filename\"' (exact name match), 'mimeType = \"application/vnd.google-apps.document\"' (Google Docs), 'mimeType = \"application/vnd.google-apps.spreadsheet\"' (Google Sheets), 'mimeType = \"application/vnd.google-apps.presentation\"' (Google Slides), 'mimeType = \"application/pdf\"' (PDF files), 'parents in \"folder_id\"' (files in specific folder), 'modifiedTime > \"2023-01-01\"' (modified after date), 'starred = true' (starred files), 'trashed = false' (not in trash), 'fullText contains \"keyword\"' (search file content).",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "Google Drive search query using Google Drive operators. Examples: 'name contains \"report\"', 'name = \"filename\"', 'mimeType = \"application/vnd.google-apps.document\" and starred = true', 'parents in \"folder_id\"', 'fullText contains \"keyword\"'"
                }
            },
            required: ["query"]
        }
    },
    userConfigSchema: {
        googleClientId: {
            type: "string",
            description: "Google OAuth2 Client ID (from Google Cloud Console)"
        },
        accessToken: {
            type: ACCESS_TOKEN_TYPE_OAUTH,
            description: "Google Drive Authentication",
            provider: OAUTH_PROVIDER,
            scope: OAUTH_PROVIDER_SCOPE,
            oauthHandler,
            required: true
        },
        maxResults: {
            type: "integer",
            description: "Maximum number of files to fetch",
            default: 5,
            minimum: 1,
            maximum: 100
        }
    },
    toSanitize: ["userConfig.accessToken"],
    handlerFactory: (
        userConfig: { accessToken?: string, maxResults?: number }
    ) => async ({query}: { query: string }): Promise<CloudStorageFileResult[] | { error: string }> => {
        try {
            if (!userConfig.accessToken) {
                return {error: "Google Drive authentication required. Please connect your Google Drive account."};
            }

            if (!userConfig.maxResults) {
                return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
            }

            // data received from the LLM needs to be sanitized to avoid issues:
            const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

            return await GraphQLService.gdriveFetchFiles(
                sanitizedQuery,
                {
                    accessToken: userConfig.accessToken,
                    maxResults: userConfig.maxResults || 10
                }
            );
        } catch (error) {
            return {error: error instanceof Error ? error.message : 'Unknown error'};
        }
    }
};