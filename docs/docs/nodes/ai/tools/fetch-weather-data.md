---
title: Fetch Weather Data Tool
---

# Fetch Weather Data Tool

The **Fetch Weather Data Tool** retrieves the current weather, a past day's weather or a forecast for a specified city using a weather API.  
It is useful for workflows that require real-time weather data as input for further processing or analysis.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `city` ¹ (string): Name of the city to fetch weather data for (e.g., `"New York"`).  
        - `date` ¹ (string, optional): The day, as `YYYY-MM-DD` (or another date form, e.g. `Nov 13, 2026`). An earlier day gives its history (up to 7 days back), a later one its forecast (up to 14 days ahead); today, no date, or a word for none (`today`, `none`) gives the current weather. Text that isn't a date gets an error asking for `YYYY-MM-DD`.
        - `apiKey` (string, user config): WeatherAPI.com API Key. Every Weather tool shares it; save it in [Settings → Credentials](../../../getting-started/configuration#credentials) as `fetch-weather-data.apiKey` to keep it after a reload.
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Weather Dashboard Workflow](/img/nodes/ai-tool/fetch-weather-data-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - *fields returned depend on the WeatherAPI.com API response*  
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `fetch-weather-data`
    </TabItem>
</Tabs>