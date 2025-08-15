/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {EmailResult, EmailSearchArgs} from '../../shared/types/email.ts';

type GmailHeader = { name: string; value: string };


export async function fetchGmailEmails (args: EmailSearchArgs): Promise<EmailResult[]> {
    const {query, maxResults, accessToken} = args;

    try {
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

        const searchData = await searchResponse.json();

        if (!searchData.messages || searchData.messages.length === 0) {
            return [];
        }

        // Fetch details for each message
        const emailPromises = searchData.messages.map(async (message: { id: string }) => {
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
                console.warn(`Failed to fetch email ${message.id}: ${detailResponse.status}`);

                return null;
            }

            const emailData = await detailResponse.json();
            const headers = emailData.payload?.headers || [];
            const getHeader = (name: string) => {
                const header = (headers as GmailHeader[]).find((h) => h.name.toLowerCase() === name.toLowerCase());

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

    } catch (error) {
        throw new Error(`Failed to fetch Gmail emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}