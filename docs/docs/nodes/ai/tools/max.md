---
title: Max Tool
---

# Max Tool

The **Max Tool** finds the row(s) with the maximum value: of a key in an array of objects, or of the values themselves in an array of values.  
It is useful for workflows that need to identify the highest value in tabular or structured data, such as finding the top customer, largest transaction, or latest date.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `rows` ¹ (array): Array of objects, or of values (numbers, dates, text, booleans), to search.  
        - `key` ¹ (string): The key/property name to find the maximum value by. Needed for an array of objects only; a key no object has is an error.
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![Max Tool Node](/img/nodes/ai-tool/max-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - Array of the rows (or values) that have the maximum value.
        - If multiple rows share the maximum value, all are returned. Rows with no value (the key missing, `null`, blank text) are left out.

        > **How values compare:** as booleans (`false` before `true`), dates or numbers when every value is one, else as text. Numbers written as text (`"1800"`, as CSV columns hold them) count as numbers. Dates are `2024-01-02`, `2024/1/2`, `01/02/2024` or `1/2/24` (month first), or text with a month name and a 4-digit year (`Jan 2, 2024`), each with a time or not; labels such as `Item 1` are text.

        **Example Output:**

        ```json
        [
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
        - `toolSubtype`: `max`
    </TabItem>
</Tabs>