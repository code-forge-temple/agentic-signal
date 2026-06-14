---
title: Web Page to Markdown Tool
---

# Web Page to Markdown Tool

The **Web Page to Markdown Tool** fetches one or more web pages by URL, extracts the main article content (stripping navigation, ads, and other noise), and returns an array of results as clean Markdown.  
It uses a headed Chromium browser under the hood, which means it works on JavaScript-rendered pages, follows redirect chains (including Google News links), and can dismiss common consent/cookie banners automatically.  
This tool is ideal for workflows that need to read and summarise the actual content of a URL found in a prior search.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `urls` ¹ (string[]): One or more full URLs of web pages to fetch (e.g., `["https://www.example.com/article"]`)
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing its input, typically one or more URLs returned by a preceding search tool.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - `title`: The page title
        - `url`: The final URL after any redirects
        - `content`: The main article body converted to Markdown
        - `excerpt`: A short description extracted from the page's `og:description` or `meta[name="description"]` tag

        **Example Output:**

        ```json
        [
            {
                "title": "Aliens might exist, but there are three reasons why they're not visiting us",
                "url": "https://theconversation.com/aliens-might-exist-but-there-are-three-reasons-why-theyre-not-visiting-us-283984",
                "content": "## Aliens might exist, but there are three reasons why they're not visiting us\n\nThe universe is vast, and the possibility of life elsewhere remains open...",
                "excerpt": "If extraterrestrial life exists, there are strong scientific reasons to think it may never reach Earth."
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `web-page-to-markdown`
    </TabItem>
</Tabs>

## Notes

- **Redirect support** — the tool waits for the full redirect chain to settle before extracting content, so short links, Google News `read/` links, and similar forwarded URLs are handled transparently.
- **Consent wall handling** — common cookie/consent dialogs (including Google's consent screen) are automatically dismissed before the page content is read.
- **Bot-detection mitigation** — the browser launches with `--disable-blink-features=AutomationControlled` and masks `navigator.webdriver`, making it appear as a regular browser to most bot-detection systems.
- **Browser path** — in the Windows desktop (Tauri) app, a browser executable path must be set in the application **Settings** before this tool can be used.
