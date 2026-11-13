---
title: Sort Tool
---

# Sort Tool

The **Sort Tool** sorts an array of row objects by a specified key, or an array of values, in a given order (ascending or descending).  
It is useful for workflows that need to organize tabular or structured data, such as sorting customers by total spend, dates, or any other property.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `rows` ¹ (array): Array of objects, or of values (numbers, dates, text, booleans), to sort.  
        - `key` ¹ (string): The key/property name to sort by. Needed for an array of objects only; a key no object has is an error.  
        - `order` ¹ (string): Sort order (`asc` for ascending, `desc` for descending).
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Sort Tool Node](/img/nodes/ai-tool/sort-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - The rows (or values) sorted by the specified key and order. Rows with no value (the key missing, `null`, blank text) come last, in their order.

        > **How values compare:** as booleans (`false` before `true`), dates or numbers when every value is one, else as text. Numbers written as text (`"1800"`, as CSV columns hold them) count as numbers. Dates are `2024-01-02`, `2024/1/2`, `01/02/2024` or `1/2/24` (month first), or text with a month name and a 4-digit year (`Jan 2, 2024`), each with a time or not; labels such as `Item 1` are text.

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