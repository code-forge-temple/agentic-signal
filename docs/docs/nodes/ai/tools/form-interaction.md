---
title: Form Interaction Tool
---

# Form Interaction Tool

The **Form Interaction Tool** navigates to a web page containing a form, discovers its fields and clickable buttons using backend browser automation (Playwright), and can fill in and submit it.  
It's built for agentic form-filling workflows — job applications, sign-ups, contact forms — where the LLM first calls the tool to *discover* what's on the page, then calls it again with the actions to fill and submit.  
The tool keeps the same browser session open across calls for the same `url`, so multi-page/multi-step forms can be filled one page at a time without losing progress between calls.

:::warning Use responsibly
This tool drives a real browser and submits real forms on real sites. You are responsible for how you use it: respect each site's Terms of Service and rate limits, don't use it to spam applications or form submissions, and don't automate around CAPTCHAs or other anti-bot measures. For job applications, apply where you're a genuine fit — mass auto-submitting wastes everyone's time, including yours.
:::

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `url` ¹ (string): URL of the web page containing the form to interact with.
        - `actions` (array, optional): List of fill actions to perform. Omit or pass an empty array to only read the form's fields and buttons. Each action:
            - `selector` (string): CSS selector of the target element.
            - `type` (string): `fill` | `select` | `check` | `uncheck` | `click` | `upload`.
            - `value` (string, optional): Text to type (`fill`), option label/value to choose (`select`); ignored for `check`/`uncheck`/`click`.
            - `fileKey` (string, optional): Original filename of a binary file attached in the [Data Source Node](/docs/nodes/input/data-source) (e.g. `"my-cv.pdf"`). Required when `type` is `upload`.
        - `submitSelector` (string, optional): CSS selector of the submit/"Next" button to click after filling. Use the `selector` value from a prior call's `actionButtons` — never a guessed selector such as `#submitBtn`. Omit to only fill without advancing.
        - `typingDelay` (number, user config): Seconds between each field action (`0` = instant fill, no pauses; `1` = default human-like pace; default: `1`)
        - `interactionTimeoutSeconds` (number, user config): Max seconds for one tool call — raise if a high typing delay combined with long text fields pushes past the default (default: `300`, min: `30`, max: `1800`)
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Form Interaction Tool](/img/nodes/ai-tool/form-interaction-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
        </TabItem>
        <TabItem value="outputs" label="Outputs">
        - `success`: Whether the call completed without error
        - `currentUrl`: The page's URL after this call
        - `pageTitle`: The page's `<title>`
        - `submitted`: Whether `submitSelector` was clicked during this call
        - `formFields`: Visible, interactive fields on the current page — `label`, `name`, `type`, `selector`, `required`, `options` (for select dropdowns), `currentValue`, `placeholder`
        - `actionButtons`: Visible, enabled clickable buttons on the current page — `label`, `selector`. Use one of these selectors for `submitSelector` on the next call.
        - `error`: Present when the call failed (e.g. required fields still empty, or `submitSelector` didn't match anything) — includes guidance for correcting the next call.

        **Example Output:**

        ```json
        {
            "success": true,
            "currentUrl": "http://localhost:3001/cv-application",
            "pageTitle": "Job Application — Agentic Signal Test Form",
            "submitted": false,
            "formFields": [
                {
                    "label": "First Name *",
                    "name": "firstName",
                    "type": "text",
                    "selector": "#firstName",
                    "required": true,
                    "currentValue": null,
                    "placeholder": "Jane"
                },
                {
                    "label": "Country",
                    "name": "country",
                    "type": "select-one",
                    "selector": "#country",
                    "required": false,
                    "options": ["United States", "United Kingdom", "Germany"],
                    "currentValue": null
                }
            ],
            "actionButtons": [
                {"label": "Submit Application", "selector": "#submitBtn"}
            ],
            "error": null
        }
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `form-interaction`
    </TabItem>
</Tabs>
