---
title: DuckDuckGo Search Tool
---

# DuckDuckGo Search Tool

The **DuckDuckGo Search Tool** performs a web search using DuckDuckGo and returns the top results.  
Because DuckDuckGo does not provide an official public API, the backend performs web scraping of the DuckDuckGo search results page behind the scenes to retrieve the data.  
This tool is useful for workflows that require up-to-date web information or need to augment AI responses with search results.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `query` ¹ (string): Search query (e.g., `"latest AI news"`)
        - `maxResults` (integer, user config): Maximum number of results to return (default: 5, min: 1, max: 20)
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.
        
        ![Weather Dashboard Workflow](/img/nodes/ai-tool/duckduckgo-search-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
        </TabItem>
        <TabItem value="outputs" label="Outputs">
        - `title`: Title of the search result
        - `url`: URL of the result
        - `description`: Short description or snippet

        **Example Output:**

        ```json
        [
            {
                "title": "DuckDuckGo launches new privacy features",
                "url": "https://duckduckgo.com/privacy-update",
                "description": "DuckDuckGo introduces new privacy-focused features for users."
            },
            {
                "title": "What is DuckDuckGo?",
                "url": "https://duckduckgo.com/about",
                "description": "Learn about DuckDuckGo, a private search engine."
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `duckduckgo-search`
    </TabItem>
</Tabs>