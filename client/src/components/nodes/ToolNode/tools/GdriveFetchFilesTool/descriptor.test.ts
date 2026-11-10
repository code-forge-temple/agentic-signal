/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, beforeEach, describe, expect, it, MockInstance, vi} from 'vitest';
import {GdriveFetchFilesToolDescriptor} from './descriptor';
import {GraphQLService} from './services/graphqlService';


const handler = GdriveFetchFilesToolDescriptor.handlerFactory({accessToken: 'token', maxResults: 3});

let search: MockInstance<typeof GraphQLService.gdriveFetchFiles>;

beforeEach(() => {
    search = vi.spyOn(GraphQLService, 'gdriveFetchFiles').mockResolvedValue([]);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Google Drive Fetch Files tool', () => {
    it('needs a query, as text', async () => {
        for (const query of ['', 42]) {
            expect(await handler({query})).toEqual({error: '`query` tool parameter must be a non-empty string'});
        }

        expect(search).not.toHaveBeenCalled();
    });

    it('searches with the query sanitized and the settings', async () => {
        await handler({query: ' name contains &quot;report&quot; '});

        expect(search).toHaveBeenCalledWith('name contains "report"', {accessToken: 'token', maxResults: 3});
    });
});
