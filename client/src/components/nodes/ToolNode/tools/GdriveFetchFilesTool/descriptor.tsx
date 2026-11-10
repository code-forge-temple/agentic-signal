/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import GoogleDrive from "./assets/google-drive.svg";
import {CloudStorageFileResult} from "@shared/types.gen";
import {sanitizeStringInput} from "../utils/sanitize";
import {googleTool} from "../utils/google/googleTool";


export const GdriveFetchFilesToolDescriptor: ToolDefinition = googleTool<{query: string}, CloudStorageFileResult[]>({
    toolSubtype: "gdrive-fetch-files",
    title: "Google Drive Fetch Files Tool",
    icon: <GoogleDrive />,
    service: "Google Drive",
    scope: "drive.readonly",
    maxResults: {items: "files", maximum: 100},
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
    fetch: async ({query}, auth) => {
        if (typeof query !== "string" || query.trim() === "") return {error: "`query` tool parameter must be a non-empty string"};

        // What the LLM sends is sanitized before use.
        return GraphQLService.gdriveFetchFiles(sanitizeStringInput(query), auth);
    },
});
