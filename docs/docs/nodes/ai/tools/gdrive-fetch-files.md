---
sidebar_position: 6
title: Google Drive Fetch Files Tool
---

# Google Drive Fetch Files Tool

The **Google Drive Fetch Files Tool** retrieves files from your Google Drive using advanced search queries.  
It is useful for workflows that need to locate, process, or analyze files stored in Google Drive.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="inputs" label="Inputs" default>
        - `query` ¹ (string): Google Drive search query using Google Drive search operators (e.g., `"name contains \"report\""`).  
        - `googleClientId` (string, user config): Google OAuth2 Client ID.  
        You must [create an OAuth2 client in Google Cloud Console](../../../getting-started/google-oauth-client) before using this tool.  
        - `accessToken` (OAuth, user config): Google Drive Authentication.  
        This field will be auto-filled if you use the **CONNECT DRIVE** button.
        - `maxResults` (integer, user config): Maximum number of files to fetch (default: 5, min: 1, max: 50)

        ![Google Drive Listing Workflow](/img/nodes/ai-tool/gdrive-fetch-files-tool.jpg)
        ___
        (1) Provided by the [AI Data Processing Node](/docs/nodes/ai/llm-process) as a result of processing its input.
    </TabItem>
    <TabItem value="outputs" label="Outputs">
        - `id`: Unique file ID
        - `name`: Name of the file
        - `mimeType`: MIME type of the file
        - `webViewLink`: Link to open the file in Google Drive
        - `createdTime`: File creation date/time
        - `modifiedTime`: Last modified date/time
        - `owners`: Array of file owner(s)
        - `parents`: Array of parent folder IDs

        **Example Output:**

        ```json
        [
            {
                "id": "1a2b3c4d5e6f",
                "name": "Project Report.pdf",
                "mimeType": "application/pdf",
                "webViewLink": "https://drive.google.com/file/d/1a2b3c4d5e6f/view",
                "createdTime": "2024-06-10T09:00:00Z",
                "modifiedTime": "2024-06-12T15:30:00Z",
                "owners": ["alice@example.com"],
                "parents": ["0BwwA4oUTeiV1TGRPeTVjaWRDY1E"]
            }
        ]
        ```
    </TabItem>
    <TabItem value="node-type" label="Node Type">
        - `ai-tool`
        - `toolSubtype`: `gdrive-fetch-files`
    </TabItem>
</Tabs>