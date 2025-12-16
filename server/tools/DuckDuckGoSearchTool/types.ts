/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const DuckDuckGoResultFields = {
    sourceAndUrl: 'String',
    title: 'String',
    description: 'String',
    url: 'String'
} as const;

export interface DuckDuckGoResult {
  sourceAndUrl: string;
  title: string;
  description: string;
  url: string;
}

export interface DuckDuckGoSearchArgs {
  query: string;
}