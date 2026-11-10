/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GoogleToolOauthConfigFields} from './GoogleToolOauthConfigFields';
import {ACCESS_TOKEN_KEY, GOOGLE_CLIENT_ID_KEY} from './oauth';
import {useGlobalConfig} from '../../../../../../stores/globalConfig';


const SCOPE = 'https://www.googleapis.com/auth/things.readonly';
const SHARED_TOKEN_KEY = `things-fetch.${ACCESS_TOKEN_KEY}`;

type OauthParams = {clientId: string; scope: string; onConfigChange: (key: string, value: string) => void};

function renderFields (userConfig: Record<string, string | undefined> = {}) {
    const oauthHandler = vi.fn<(params: OauthParams) => void>();
    const onConfigChange = vi.fn<(key: string, value: string | number | boolean) => void>();

    render(
        <GoogleToolOauthConfigFields
            toolSubtype="things-fetch"
            scope={SCOPE}
            provider="things.readonly"
            oauthHandler={oauthHandler}
            description="Google Things Authentication"
            userConfig={userConfig}
            onConfigChange={onConfigChange}
        />
    );

    return {oauthHandler, onConfigChange};
}

const sharedData = () => useGlobalConfig.getState().globalData;

beforeEach(() => {
    useGlobalConfig.setState({globalData: {}});
});

afterEach(() => {
    cleanup();
});

describe('GoogleToolOauthConfigFields', () => {
    it('signs in with the Client ID and the scope; the token goes to the node and is shared with every node of the kind', () => {
        useGlobalConfig.setState({globalData: {[GOOGLE_CLIENT_ID_KEY]: 'client-1'}});

        const {oauthHandler, onConfigChange} = renderFields();

        fireEvent.click(screen.getByRole('button', {name: 'Connect things.readonly'}));

        const [{clientId, scope, onConfigChange: signedIn}] = oauthHandler.mock.calls[0];

        expect({clientId, scope}).toEqual({clientId: 'client-1', scope: SCOPE});

        signedIn(ACCESS_TOKEN_KEY, 'token-1');

        expect(onConfigChange).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, 'token-1');
        expect(sharedData()[SHARED_TOKEN_KEY]).toBe('token-1');
    });

    it('shows a shared token as connected, and disconnecting clears it on the node and for every node', () => {
        useGlobalConfig.setState({globalData: {[SHARED_TOKEN_KEY]: 'token-1'}});

        const {onConfigChange} = renderFields({[ACCESS_TOKEN_KEY]: 'own-token'});

        expect(screen.getByRole('button', {name: 'Reconnect things.readonly'})).toBeTruthy();

        fireEvent.click(screen.getByTestId('CancelIcon'));

        expect(onConfigChange).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, '');
        expect(sharedData()[SHARED_TOKEN_KEY]).toBe('');
    });

    it('shows the shared Client ID over the node\'s own, even a cleared one', () => {
        useGlobalConfig.setState({globalData: {[GOOGLE_CLIENT_ID_KEY]: ''}});
        renderFields({[GOOGLE_CLIENT_ID_KEY]: 'own-client'});

        expect(screen.getByLabelText<HTMLInputElement>('Google OAuth2 Client ID').value).toBe('');
        expect(screen.getByRole('button', {name: 'Connect things.readonly'})).toBeTruthy();
    });
});
