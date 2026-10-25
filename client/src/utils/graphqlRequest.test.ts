/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {graphqlRequest} from './graphqlRequest';
import {graphqlBaseUrl} from './utils';

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
});

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
});

describe('graphqlRequest', () => {
    it('POSTs the query and variables, merges extra headers, and returns data', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({data: {renderHtml: '<p>hi</p>'}}));

        const data = await graphqlRequest<{ renderHtml: string }>('query { renderHtml }', {url: 'https://x'}, {Authorization: 'Bearer t'});

        expect(data).toEqual({renderHtml: '<p>hi</p>'});
        expect(fetchMock).toHaveBeenCalledWith(graphqlBaseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: 'Bearer t'},
            body: JSON.stringify({query: 'query { renderHtml }', variables: {url: 'https://x'}}),
        });
    });

    it('throws the GraphQL error messages, one per line', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({data: null, errors: [{message: 'first'}, {message: 'second'}]}));

        await expect(graphqlRequest('query { x }', {})).rejects.toThrow('first\nsecond');
    });

    it('prefers the GraphQL error messages over the HTTP status', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({errors: [{message: 'Variable "$url" of required type "String!" was not provided.'}]}, 400));

        await expect(graphqlRequest('query { x }', {})).rejects.toThrow('Variable "$url" of required type "String!" was not provided.');
    });

    it('throws the HTTP status when an error response is not JSON', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', {status: 502, statusText: 'Bad Gateway'}));

        await expect(graphqlRequest('query { x }', {})).rejects.toThrow('HTTP 502: Bad Gateway');
    });

    it('throws when a successful response carries no data', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await expect(graphqlRequest('query { x }', {})).rejects.toThrow('Malformed GraphQL response: no data');
    });
});
