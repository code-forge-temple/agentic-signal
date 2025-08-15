/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CloudStorageFileResult, CloudStorageFileSearchArgs} from '../../shared/types/cloudStorage.ts';

interface DriveFileResponse {
    id: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    modifiedTime?: string;
    size?: string;
    owners?: { displayName: string }[];
}

interface DriveApiResponse {
    files: DriveFileResponse[];
}

async function readFileContent (fileId: string, mimeType: string, accessToken: string): Promise<string> {
    try {
        if (mimeType.includes('google-apps')) {
            let exportMimeType = 'text/plain';

            if (mimeType.includes('document')) {
                exportMimeType = 'text/plain';
            } else if (mimeType.includes('spreadsheet')) {
                exportMimeType = 'text/csv';
            } else if (mimeType.includes('presentation')) {
                exportMimeType = 'text/plain';
            }

            const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;

            const response = await fetch(exportUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                return `[Could not read content: ${response.statusText}]`;
            }

            return await response.text();
        } else {
            // For regular files (text, PDF, etc.), use download endpoint
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

            const response = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                return `[Could not read content: ${response.statusText}]`;
            }

            // For text-based files, return as text; for others, return info about the file
            if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('xml')) {
                return await response.text();
            } else {
                return `[Binary file content - ${mimeType}]`;
            }
        }
    } catch (error) {
        return `[Error reading content: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
}

export async function fetchGdriveFiles (args: CloudStorageFileSearchArgs): Promise<CloudStorageFileResult[]> {
    const {query, maxResults, accessToken} = args;

    try {
        // eslint-disable-next-line max-len
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=${maxResults}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size,owners)`;

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

        const searchData: DriveApiResponse = await searchResponse.json();

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