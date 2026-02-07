---
title: Min Tool
---

# Min Tool

The **Min Tool** finds the row(s) with the minimum value for a specified key in an array of objects.  
It is useful for workflows that need to identify the lowest value in tabular or structured data, such as finding the customer with the smallest spend, the smallest transaction, or the earliest date.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `rows` ¹ (array): Array of objects to search.  
        - `key` ¹ (string): The key/property name to find the minimum value by.
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Min Tool Node](/img/nodes/ai-tool/min-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - Array of objects (rows) that have the minimum value for the specified key.
        - If multiple rows share the minimum value, all are returned.

        **Example Output:**

        ```json
        [
            {
                "customer": "Bob",
                "total_spend": 98.75,
                "orders": 2
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `min`
    </TabItem>
</Tabs>