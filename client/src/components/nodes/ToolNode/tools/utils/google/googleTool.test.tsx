/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GoogleAuth, googleTool} from './googleTool';
import {ACCESS_TOKEN_KEY, ACCESS_TOKEN_TYPE_OAUTH, GOOGLE_CLIENT_ID_KEY, googleOauthHandler} from './oauth';
import {useGlobalConfig} from '../../../../../../stores/globalConfig';


const fetchThings = vi.fn<(params: {query: string}, auth: GoogleAuth) => Promise<string[] | {error: string}>>();

const tool = googleTool({
    toolSubtype: 'things-fetch',
    title: 'Things Fetch Tool',
    icon: <svg />,
    service: 'Google Things',
    scope: 'things.readonly',
    maxResults: {items: 'things', maximum: 40},
    toolSchema: {name: 'thingsFetch', description: 'Fetches things.', parameters: {type: 'object', properties: {}, required: []}},
    fetch: fetchThings,
});

const SIGNED_IN = {accessToken: 'token', maxResults: 3};

beforeEach(() => {
    fetchThings.mockReset();
    useGlobalConfig.setState({globalData: {}});
});

afterEach(() => {
    cleanup();
});

describe('googleTool', () => {
    it('keeps what is the tool\'s own', () => {
        expect(tool.toolSubtype).toBe('things-fetch');
        expect(tool.title).toBe('Things Fetch Tool');
        expect(tool.toolSchema.name).toBe('thingsFetch');
    });

    it('adds the Client ID, the OAuth sign-in for the scope and a maxResults within the API\'s limit', () => {
        expect(tool.userConfigSchema[GOOGLE_CLIENT_ID_KEY]).toEqual({type: 'string', description: 'Google OAuth2 Client ID (from Google Cloud Console)'});
        expect(tool.userConfigSchema[ACCESS_TOKEN_KEY]).toEqual({
            type: ACCESS_TOKEN_TYPE_OAUTH,
            description: 'Google Things Authentication',
            provider: 'things.readonly',
            scope: 'https://www.googleapis.com/auth/things.readonly',
            oauthHandler: googleOauthHandler,
            required: true,
        });
        expect(tool.userConfigSchema.maxResults).toEqual({type: 'integer', description: 'Maximum number of things to fetch', default: 5, minimum: 1, maximum: 40});
        expect(tool.userConfigSchema.requireToolUse).toBeDefined();
    });

    it('offers only the Client ID to Settings → Credentials, and leaves it and the access token out of saved workflows', () => {
        expect(tool.globalSecrets).toEqual([GOOGLE_CLIENT_ID_KEY]);
        expect(tool.toSanitize).toEqual([`userConfig.${ACCESS_TOKEN_KEY}`, `userConfig.${GOOGLE_CLIENT_ID_KEY}`]);
    });

    it('asks for the sign-in, then for maxResults, before the tool\'s own part runs', async () => {
        expect(await tool.handlerFactory({maxResults: 3})({query: 'q'})).toEqual({error: 'Google Things authentication required. Please connect your Google Things account.'});
        expect(await tool.handlerFactory({accessToken: 'token'})({query: 'q'})).toEqual({error: 'Maximum results must be specified. Please set maxResults in the configuration.'});
        expect(fetchThings).not.toHaveBeenCalled();
    });

    it('gives the tool\'s own part what the LLM sent and the settings, and returns what it found', async () => {
        fetchThings.mockResolvedValue(['a thing']);

        expect(await tool.handlerFactory(SIGNED_IN)({query: 'q'})).toEqual(['a thing']);
        expect(fetchThings).toHaveBeenCalledWith({query: 'q'}, {accessToken: 'token', maxResults: 3});
    });

    it('turns a failure into an error the LLM can read', async () => {
        fetchThings.mockRejectedValueOnce(new Error('quota exceeded'));
        expect(await tool.handlerFactory(SIGNED_IN)({query: 'q'})).toEqual({error: 'quota exceeded'});

        fetchThings.mockRejectedValueOnce('no reason');
        expect(await tool.handlerFactory(SIGNED_IN)({query: 'q'})).toEqual({error: 'Unknown error'});
    });

    it('shows the sign-in once, named after the scope, and the other settings in the generic form', () => {
        render(<>{tool.renderConfig?.({userConfig: {maxResults: 7}, onConfigChange: () => {}})}</>);

        expect(screen.getAllByLabelText('Google OAuth2 Client ID')).toHaveLength(1);
        expect(screen.getByRole('button', {name: 'Connect things.readonly'})).toBeTruthy();
        expect(screen.getByText('Google Things Authentication')).toBeTruthy();
        expect(screen.getByDisplayValue('7')).toBeTruthy();
    });
});
