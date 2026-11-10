/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import Gmail from "./assets/gmail.svg";
import {EmailResult} from "@shared/types.gen";
import {sanitizeStringInput} from "../utils/sanitize";
import {googleTool} from "../utils/google/googleTool";


export const GmailFetchEmailsToolDescriptor: ToolDefinition = googleTool<{query: string}, EmailResult[]>({
    toolSubtype: "gmail-fetch-emails",
    title: "Gmail Fetch Emails Tool",
    icon: <Gmail />,
    service: "Gmail",
    scope: "gmail.readonly",
    maxResults: {items: "emails", maximum: 50},
    toolSchema: {
        name: "gmailFetchEmails",
        // eslint-disable-next-line max-len
        description: "Fetches emails from Gmail using Gmail's search query syntax. Use Gmail search operators like: 'in:inbox' (inbox emails), 'from:email@domain.com' (from specific sender), 'to:email@domain.com' (to specific recipient), 'subject:keyword' (subject contains keyword), 'newer_than:7d' (last 7 days), 'older_than:30d' (older than 30 days), 'is:unread' (unread emails), 'has:attachment' (with attachments), 'label:labelname' (with specific label). Combine with AND/OR operators. Examples: 'in:inbox newer_than:7d', 'from:john@example.com OR from:jane@example.com', 'subject:meeting has:attachment'.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    // eslint-disable-next-line max-len
                    description: "Gmail search query using Gmail search operators. Examples: 'in:inbox' (recent inbox emails), 'from:someone@example.com' (emails from specific sender), 'newer_than:7d' (last 7 days), 'subject:meeting' (subject contains 'meeting'), 'is:unread' (unread emails)"
                }
            },
            required: ["query"]
        }
    },
    fetch: async ({query}, auth) => {
        if (!query || String(query).trim() === "") return {error: "`query` tool parameter must be specified"};

        // What the LLM sends is sanitized before use.
        return GraphQLService.gmailFetchEmails(sanitizeStringInput(query), auth);
    },
});
