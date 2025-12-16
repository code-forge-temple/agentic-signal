/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BraveResult} from "./types.ts";


export async function fetchBraveSearchResults (query: string, apiKey: string, maxResults: number): Promise<BraveResult[]> {
    const params = new URLSearchParams({
        q: query,
        result_filter: "web",
        count: maxResults.toString(),
    });

    const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
        {
            headers: {
                "Accept": "application/json",
                "X-Subscription-Token": apiKey,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.web || !Array.isArray(data.web.results)) {
        return [];
    }

    return data.web.results.map((item: any) => ({
        title: item.title,
        url: item.url,
        description: item.description,
    }));
}