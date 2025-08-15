/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const CloudStorageFileResultFields = {
    id: 'String!',
    name: 'String',
    mimeType: 'String',
    webViewLink: 'String',
    modifiedTime: 'String',
    size: 'String',
    owners: '[String]',
    content: 'String'
} as const;

export interface CloudStorageFileResult {
    id: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    modifiedTime?: string;
    size?: string;
    owners?: string[];
    content?: string;
}

export interface CloudStorageFileSearchArgs {
    query: string;
    maxResults: number;
    accessToken: string;
}