/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {CloudStorageFileResult, CloudStorageFileSearchArgs} from "./types.ts";
import {parseApiResponse} from "../../utils/apiResponse.ts";

// The fields requested via `fields=files(...)` in the files.list call below.
const DriveFileSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    mimeType: z.string().optional(),
    webViewLink: z.string().optional(),
    modifiedTime: z.string().optional(),
    size: z.string().optional(),
    owners: z.array(z.object({displayName: z.string()})).optional(),
});

const DriveFileListSchema = z.object({
    files: z.array(DriveFileSchema).optional(),
});

type DriveFileResponse = z.infer<typeof DriveFileSchema>;

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';

// A Google Docs editors file (a Doc, Sheet or Slides) has no bytes to download: it's exported, a sheet as CSV and
// anything else as plain text. Any other file is downloaded as it is.
const contentUrl = (fileId: string, mimeType: string, isGoogleFile: boolean) => {
    if (!isGoogleFile) return `${FILES_URL}/${fileId}?alt=media`;

    const exportMimeType = mimeType.includes('spreadsheet') ? 'text/csv' : 'text/plain';

    return `${FILES_URL}/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
};

const isTextFile = (mimeType: string) => ['text', 'json', 'xml'].some(kind => mimeType.includes(kind));

async function readFileContent (fileId: string, mimeType: string, accessToken: string): Promise<string> {
    const isGoogleFile = mimeType.includes('google-apps');

    try {
        const response = await fetch(contentUrl(fileId, mimeType, isGoogleFile), {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            return `[Could not read content: ${response.statusText}]`;
        }

        // A binary file is only named.
        return isGoogleFile || isTextFile(mimeType) ? await response.text() : `[Binary file content - ${mimeType}]`;
    } catch (error) {
        return `[Error reading content: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
}

export async function fetchGdriveFiles (args: CloudStorageFileSearchArgs): Promise<CloudStorageFileResult[]> {
    const {query, maxResults, accessToken} = args;

    try {
        const url = `${FILES_URL}?q=${encodeURIComponent(query)}&pageSize=${maxResults}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size,owners)`;

        const searchResponse = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!searchResponse.ok) {
            const errorBody = await searchResponse.text();

            throw new Error(`Google Drive API search failed: ${searchResponse.status} ${searchResponse.statusText} - Response: ${errorBody}`);
        }

        const searchData = parseApiResponse(await searchResponse.json(), DriveFileListSchema, "Google Drive (files.list)");

        if (!searchData.files || searchData.files.length === 0) {
            return [];
        }

        // Now fetch content for each file
        const filesWithContent = await Promise.all(
            searchData.files.map(async (file: DriveFileResponse): Promise<CloudStorageFileResult> => {
                const content = await readFileContent(file.id, file.mimeType || '', accessToken);

                return {
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    webViewLink: file.webViewLink,
                    modifiedTime: file.modifiedTime,
                    size: file.size,
                    owners: file.owners?.map(owner => owner.displayName) || [],
                    content: content
                };
            })
        );

        return filesWithContent;

    } catch (error) {
        console.error('Error in fetchGdriveFiles service:', error);

        throw new Error(`Failed to fetch Google Drive files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}