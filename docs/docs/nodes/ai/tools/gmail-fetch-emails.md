---
sidebar_position: 5
title: Gmail Fetch Emails Tool
---

# Gmail Fetch Emails Tool

The **Gmail Fetch Emails Tool** retrieves emails from Gmail using advanced search queries.  
It is useful for workflows that need to process, summarize, or analyze email content.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `query` ¹ (string): Gmail search query using Gmail search operators (e.g., `"in:inbox newer_than:7d"`).  
        - `googleClientId` (string, user config): Google OAuth2 Client ID.  
        You must [create an OAuth2 client in Google Cloud Console](https://console.cloud.google.com/auth/clients) before using this tool.
        - `accessToken` (OAuth, user config): Gmail Authentication.  
        This field will be auto-filled if you use the **CONNECT GMAIL** button.
        - `maxResults` (integer, user config): Maximum number of emails to fetch (default: 5, min: 1, max: 50)

        ![Weather Dashboard Workflow](/img/nodes/ai-tool/gmail-fetch-emails-tool.jpg)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing it's input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - `subject`: Subject of the email
        - `from`: Sender's email address
        - `to`: Recipient(s) email address
        - `date`: Date of the email
        - `snippet`: Short snippet of the email body
        - `id`: Unique email ID

        **Example Output:**
        ```json
        [
            {
                "subject": "Meeting Reminder",
                "from": "alice@example.com",
                "to": "bob@example.com",
                "date": "2024-06-10T09:00:00Z",
                "snippet": "Don't forget our meeting at 10am.",
                "id": "17c8a2b1e2a3b4c5"
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `gmail-fetch-emails`
    </TabItem>
</Tabs>