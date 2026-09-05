/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BraveResult} from "./types.ts";


const MAX_RATE_LIMIT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;

function sleep (ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retries only on 429 — other errors (bad API key, 5xx, etc.) aren't fixed by waiting.
// Honors the API's own Retry-After header when present, falling back to linear backoff.
async function fetchWithRateLimitRetry (url: string, headers: Record<string, string>): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(url, {headers});

        if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) {
            return response;
        }

        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader && !isNaN(Number(retryAfterHeader))
            ? Number(retryAfterHeader) * 1000
            : DEFAULT_RETRY_DELAY_MS * (attempt + 1);

        await sleep(retryAfterMs);
    }
}

export async function fetchBraveSearchResults (query: string, apiKey: string, maxResults: number): Promise<BraveResult[]> {
    const params = new URLSearchParams({
        q: query,
        result_filter: "web",
        count: maxResults.toString(),
    });

    const response = await fetchWithRateLimitRetry(
        `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
        {
            "Accept": "application/json",
            "X-Subscription-Token": apiKey,
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