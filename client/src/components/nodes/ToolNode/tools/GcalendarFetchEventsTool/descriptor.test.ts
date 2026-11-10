/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, beforeEach, describe, expect, it, MockInstance, vi} from 'vitest';
import {GcalendarFetchEventsToolDescriptor} from './descriptor';
import {GraphQLService} from './services/graphqlService';


const NOW = new Date('2026-05-01T10:00:00Z');
const handler = GcalendarFetchEventsToolDescriptor.handlerFactory({accessToken: 'token', maxResults: 3});

let search: MockInstance<typeof GraphQLService.gcalendarFetchEvents>;

beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(NOW);
    search = vi.spyOn(GraphQLService, 'gcalendarFetchEvents').mockResolvedValue([]);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('Google Calendar Fetch Events tool', () => {
    it('fetches every event of the next 30 days for an empty query', async () => {
        await handler({query: ''});

        expect(search).toHaveBeenCalledWith('', {
            timeMin: '2026-05-01T10:00:00.000Z',
            timeMax: '2026-05-31T10:00:00.000Z',
            accessToken: 'token',
            maxResults: 3,
        });
    });

    it('searches the range the LLM asked for, as ISO times, with the query sanitized', async () => {
        await handler({query: ' lunch ', timeMin: '2026-06-01T00:00:00Z', timeMax: '2026-06-02'});

        expect(search).toHaveBeenCalledWith('lunch', expect.objectContaining({
            timeMin: '2026-06-01T00:00:00.000Z',
            timeMax: '2026-06-02T00:00:00.000Z',
        }));
    });

    it('falls back to the default range for a time it cannot read', async () => {
        await handler({query: 'x', timeMin: 'next week', timeMax: ''});

        expect(search).toHaveBeenCalledWith('x', expect.objectContaining({
            timeMin: '2026-05-01T10:00:00.000Z',
            timeMax: '2026-05-31T10:00:00.000Z',
        }));
    });
});
