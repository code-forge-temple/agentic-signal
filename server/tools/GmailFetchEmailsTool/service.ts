/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {EmailResult, EmailSearchArgs} from "./types.ts";
import {parseApiResponse} from "../../utils/apiResponse.ts";


const GmailMessageListSchema = z.object({
    messages: z.array(z.object({id: z.string()})).optional(),
});

const GmailMessageMetadataSchema = z.object({
    payload: z.object({
        headers: z.array(z.object({name: z.string(), value: z.string()})).optional(),
    }).optional(),
});

export async function fetchGmailEmails (args: EmailSearchArgs): Promise<EmailResult[]> {
    const {query, maxResults, accessToken} = args;

    const searchResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        }
    );

    if (!searchResponse.ok) {
        throw new Error(`Gmail API search failed: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const searchData = parseApiResponse(await searchResponse.json(), GmailMessageListSchema, "Gmail (messages.list)");

    if (!searchData.messages || searchData.messages.length === 0) {
        return [];
    }

    // Fetch details for each message
    const emailPromises = searchData.messages.map(async (message): Promise<EmailResult | null> => {
        const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!detailResponse.ok) {
            return null;
        }

        const emailData = parseApiResponse(await detailResponse.json(), GmailMessageMetadataSchema, "Gmail (messages.get)");
        const headers = emailData.payload?.headers || [];
        const getHeader = (name: string) => {
            const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());

            return header?.value || '';
        };

        return {
            id: message.id,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            date: getHeader('Date')
        };
    });

    const results = await Promise.all(emailPromises);

    return results.filter((email): email is EmailResult => email !== null);
}