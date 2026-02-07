---
title: CSV to Array Tool
---

# CSV to Array Tool

The **CSV to Array Tool** converts CSV file content into an array of objects for downstream processing.  
It is useful for workflows that need to analyze, transform, or summarize tabular data from CSV files.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `csv` ¹ (string): CSV file content as a string.  
        - `requireToolUse` (boolean, user config): Require tool use (forces the LLM to always call this tool; default: true)
            > **Note:** When enabled, the node will retry tool calls up to the number of times set in [Max Tool Retries](/docs/nodes/ai/llm-process?activeTab=max-tool-retries#configuration) in the AI Data Processing Node.

        ![CSV to Array Tool](/img/nodes/ai-tool/csv-to-array-tool.webp)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input (for ex: [Data Source Node](/docs/nodes/input/data-source)).
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - Array of objects, where each object represents a row in the CSV file.
        - Keys correspond to column headers.

        **Example Output:**

        ```json
        [
            {
                "customer": "Alice",
                "total_spend": 120.50,
                "orders": 3
            },
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
        - `toolSubtype`: `csv-to-array`
    </TabItem>
</Tabs>