---
title: Sort Tool
---

# Sort Tool

The **Sort Tool** sorts an array of row objects by a specified key and order (ascending or descending).  
It is useful for workflows that need to organize tabular or structured data, such as sorting customers by total spend, dates, or any other property.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `rows` ¹ (array): Array of objects to sort.  
        - `key` ¹ (string): The key/property name to sort by.  
        - `order` ¹ (string): Sort order (`asc` for ascending, `desc` for descending).
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Sort Tool Node](/img/nodes/ai-tool/sort-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - Array of objects sorted by the specified key and order.

        **Example Output:**

        ```json
        [
            {
                "customer": "Bob",
                "total_spend": 98.75,
                "orders": 2
            },
            {
                "customer": "Alice",
                "total_spend": 120.50,
                "orders": 3
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `sort`
    </TabItem>
</Tabs>