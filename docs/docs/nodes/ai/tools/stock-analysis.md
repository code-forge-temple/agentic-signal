---
title: Stock Analysis Tool
---

# Stock Analysis Tool

The **Stock Analysis Tool** analyzes historical stock data and computes technical indicators including moving averages, volatility, trend classification, and more.  
It is useful for workflows that require stock market analysis or need to process OHLCV (Open, High, Low, Close, Volume) data.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `symbol` ¹ (string): Stock symbol (e.g., `"AAPL"`, `"GOOG"`, `"MSFT"`)
        - `data` ¹ (array): Array of historical OHLCV data points (minimum 10 points required)
            - Each data point must include:
                - `timestamp` (string): ISO date/time string
                - `open` (number): Opening price
                - `high` (number): Highest price
                - `low` (number): Lowest price
                - `close` (number): Closing price
                - `volume` (number): Trading volume
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Stock Analysis Tool](/img/nodes/ai-tool/stock-analysis-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - `symbol`: Stock symbol that was analyzed
        - `close`: Most recent closing price
        - `pctChange`: Percentage change from previous close
        - `sma5`: Simple Moving Average (5 periods)
        - `sma10`: Simple Moving Average (10 periods)
        - `volumeRatio`: Ratio of current volume to average volume (last 10 periods)
        - `slope`: Trend slope (price change over 10 periods)
        - `volatility`: Price volatility (standard deviation of last 10 closes)
        - `trend`: Trend classification (`"up"`, `"down"`, or `"sideways"`)
        - `analysisPeriod`: Object containing `start` and `end` timestamps of the analysis period

        **Example Output:**

        ```json
        {
            "symbol": "AAPL",
            "close": 178.45,
            "pctChange": 0.0234,
            "sma5": 176.82,
            "sma10": 174.56,
            "volumeRatio": 1.23,
            "slope": 0.389,
            "volatility": 2.14,
            "trend": "up",
            "analysisPeriod": {
                "start": "2026-03-20T00:00:00Z",
                "end": "2026-04-05T00:00:00Z"
            }
        }
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `stock-analysis`
    </TabItem>
</Tabs>
