/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const WebPageToMarkdownResultFields = {
    title: 'String',
    url: 'String',
    content: 'String',
    excerpt: 'String',
} as const;

export type WebPageToMarkdownResult = {
    title: string;
    url: string;
    content: string;
    excerpt: string;
};

export type WebPageToMarkdownArgs = {
    urls: string[];
    browserPath?: string;
};
