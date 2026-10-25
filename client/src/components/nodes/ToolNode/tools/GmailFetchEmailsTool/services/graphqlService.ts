/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {EmailResult} from "@shared/types.gen";
import {graphqlRequest} from "../../../../../../utils";


export class GraphQLService {
    static async gmailFetchEmails (query: string, userConfig: { accessToken: string, maxResults: number }): Promise<EmailResult[]> {
        const data = await graphqlRequest<{ gmailFetchEmails: EmailResult[] }>(
            /* GraphQL */ `
                query($query: String!, $maxResults: Int!) {
                    gmailFetchEmails(query: $query, maxResults: $maxResults) {
                        id
                        subject
                        from
                        date
                    }
                }
            `,
            {query, maxResults: userConfig.maxResults},
            {Authorization: `Bearer ${userConfig.accessToken}`}
        );

        return data.gmailFetchEmails;
    }
}