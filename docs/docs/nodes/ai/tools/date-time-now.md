---
sidebar_position: 4
title: Date/Time Now Tool
---

# Date/Time Now Tool

The **Date/Time Now Tool** returns the current date and time in ISO 8601 format.  
It is useful for workflows that require a timestamp or need to know the current time.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - *None required*

        ![Weather Dashboard Workflow](/img/nodes/ai-tool/datetime-now-tool.jpg)
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - `iso`: Current date and time in ISO 8601 format (e.g., `2024-06-10T12:34:56.789Z`)
        - `locale`: Current date and time in the user's locale string
        - `unix`: Current time as a Unix timestamp (seconds since epoch)

        **Example Output:**
        
        ```json
        {
            "iso": "2024-06-10T12:34:56.789Z",
            "locale": "6/10/2024, 12:34:56 PM",
            "unix": 1718020496
        }
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `date-time-now`
    </TabItem>
</Tabs>