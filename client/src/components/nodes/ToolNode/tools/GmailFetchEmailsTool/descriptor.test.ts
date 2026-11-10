/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, beforeEach, describe, expect, it, MockInstance, vi} from 'vitest';
import {GmailFetchEmailsToolDescriptor} from './descriptor';
import {GraphQLService} from './services/graphqlService';


const handler = GmailFetchEmailsToolDescriptor.handlerFactory({accessToken: 'token', maxResults: 3});

let search: MockInstance<typeof GraphQLService.gmailFetchEmails>;

beforeEach(() => {
    search = vi.spyOn(GraphQLService, 'gmailFetchEmails').mockResolvedValue([]);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Gmail Fetch Emails tool', () => {
    it('needs a query', async () => {
        expect(await handler({query: '  '})).toEqual({error: '`query` tool parameter must be specified'});
        expect(search).not.toHaveBeenCalled();
    });

    it('searches with the query sanitized and the settings', async () => {
        await handler({query: ' in:inbox '});

        expect(search).toHaveBeenCalledWith('in:inbox', {accessToken: 'token', maxResults: 3});
    });
});
