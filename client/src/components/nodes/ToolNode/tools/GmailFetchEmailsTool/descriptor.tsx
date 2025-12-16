/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLService} from "./services/graphqlService";
import {ToolDefinition} from "../types";
import Gmail from "./assets/gmail.svg";
import {EmailResult} from "@shared/types.gen";
import {OAUTH_PROVIDER, OAUTH_PROVIDER_SCOPE, oauthHandler} from "./constants";
import {ACCESS_TOKEN_TYPE_OAUTH} from "../utils/oauth";


export const GmailFetchEmailsToolDescriptor:ToolDefinition = {
    toolSubtype: "gmail-fetch-emails",
    title: "Gmail Fetch Emails Tool",
    icon: <Gmail />,
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
    userConfigSchema: {
        googleClientId: {
            type: "string",
            description: "Google OAuth2 Client ID (from Google Cloud Console)"
        },
        accessToken: {
            type: ACCESS_TOKEN_TYPE_OAUTH, // This will be rendered as a OAuth2 button + an access token input in the UI
            description: "Gmail Authentication",
            provider: OAUTH_PROVIDER,
            scope: OAUTH_PROVIDER_SCOPE,
            oauthHandler,
            required: true
        },
        maxResults: {
            type: "integer",
            description: "Maximum number of emails to fetch",
            default: 5,
            minimum: 1,
            maximum: 50
        }
    },
    toSanitize: ["userConfig.accessToken"],
    handlerFactory: (
        userConfig: { accessToken?: string, maxResults?: number }
    ) => async ({query}: { query: string }): Promise<EmailResult[] | { error: string }> => {

        try {
            if (!userConfig.accessToken) {
                return {error: "Gmail authentication required. Please connect your Gmail account."};
            }

            if (!userConfig.maxResults) {
                return {error: "Maximum results must be specified. Please set maxResults in the configuration."};
            }

            // data received from the LLM needs to be sanitized to avoid issues:
            const sanitizedQuery = (query || "").replace(/["“”]/g, '"').replace(/['‘’]/g, "'");

            return await GraphQLService.gmailFetchEmails(
                sanitizedQuery,
                {
                    accessToken: userConfig.accessToken,
                    maxResults: userConfig.maxResults || 5
                }
            );
        } catch (error) {
            return {error: error instanceof Error ? error.message : 'Unknown error'};
        }
    }
};