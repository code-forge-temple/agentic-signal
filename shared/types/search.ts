/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const SearchResultFields = {
    sourceAndUrl: 'String',
    title: 'String',
    description: 'String',
    url: 'String'
} as const;

export const BraveResultFields = {
    title: 'String',
    url: 'String',
    description: 'String'
} as const;

export interface DuckDuckGoResult {
  sourceAndUrl: string;
  title: string;
  description: string;
  url: string;
}

export interface BraveResult {
  title: string;
  url: string;
  description: string;
}

export interface DuckDuckGoSearchArgs {
  query: string;
}

export interface BraveSearchArgs {
  query: string;
  apiKey: string;
  maxResults: number;
}