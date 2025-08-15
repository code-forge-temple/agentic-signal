---
sidebar_position: 7
title: Google Calendar Fetch Events Tool
---

# Google Calendar Fetch Events Tool

The **Google Calendar Fetch Events Tool** retrieves events from your Google Calendar using advanced search queries.  
It is useful for workflows that need to locate, process, or analyze calendar events.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `query` ¹ (string): Text search query to find events by summary or description.
        - `timeMin` ¹ (string, optional): Lower bound (inclusive) for event start time (RFC3339 timestamp).  
        - `timeMax` ¹ (string, optional): Upper bound (exclusive) for event end time (RFC3339 timestamp).  
        - `googleClientId` (string, user config): Google OAuth2 Client ID.  
        You must [create an OAuth2 client in Google Cloud Console](https://console.cloud.google.com/auth/clients) before using this tool.
        - `accessToken` (OAuth, user config): Google Calendar Authentication.  
        This field will be auto-filled if you use the **CONNECT CALENDAR** button.
        - `maxResults` (integer, user config): Maximum number of events to fetch (default: 10, min: 1, max: 100)

        ![Google Calendar Listing Workflow](/img/nodes/ai-tool/gcalendar-fetch-events-tool.jpg)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing its input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - `id`: Unique event ID
        - `summary`: Title of the event
        - `description`: Description of the event
        - `start`: Start date/time (RFC3339)
        - `end`: End date/time (RFC3339)
        - `location`: Event location (if any)
        - `attendees`: Array of attendee email addresses
        - `organizer`: Organizer email address
        - `htmlLink`: Link to view the event in Google Calendar

        **Example Output:**

        ```json
        [
            {
                "id": "abc123def456",
                "summary": "Team Meeting",
                "description": "Weekly sync-up",
                "start": "2024-06-15T10:00:00Z",
                "end": "2024-06-15T11:00:00Z",
                "location": "Conference Room 1",
                "attendees": ["alice@example.com", "bob@example.com"],
                "organizer": "manager@example.com",
                "htmlLink": "https://calendar.google.com/calendar/event?eid=abc123def456"
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `gcalendar-fetch-events`
    </TabItem>
</Tabs>