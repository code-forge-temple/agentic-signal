/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const EmailResultFields = {
    id: 'String!',
    subject: 'String',
    from: 'String',
    date: 'String'
} as const;

export type EmailResult = {
    id: string;
    subject?: string;
    from?: string;
    date?: string;
};

export type EmailSearchArgs = {
    query: string;
    maxResults: number;
    accessToken: string;
};