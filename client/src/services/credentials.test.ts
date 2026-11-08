/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {createElement} from 'react';
import {CREDENTIAL_NAME, credentialStoreKey, customCredentialNames, knownCredentials} from './credentials';


const owner = (title: string, globalSecrets?: string[]) => ({title, icon: createElement('svg'), globalSecrets});

describe('knownCredentials', () => {
    it('lists each declared key once, with everything that declares it, in the order first declared', () => {
        const slackInput = owner('Slack Input', ['slackBotToken', 'slackAppToken']);
        const timer = owner('Timer');
        const slackOutput = owner('Slack Output', ['slackBotToken']);

        expect(knownCredentials([slackInput, timer, slackOutput])).toEqual([
            {key: 'slackBotToken', owners: [slackInput, slackOutput]},
            {key: 'slackAppToken', owners: [slackInput]},
        ]);
    });
});

describe('credentialStoreKey', () => {
    const known = knownCredentials([owner('Slack Input', ['slackBotToken'])]);

    it('keeps a declared credential under its own key, where the nodes read it', () => {
        expect(credentialStoreKey('slackBotToken', known)).toBe('slackBotToken');
    });

    it('keeps a custom one apart from the app\'s own keys, so it can never overwrite one', () => {
        expect(credentialStoreKey('ALPHA_VANTAGE_KEY', known)).toBe('credential.ALPHA_VANTAGE_KEY');
        expect(credentialStoreKey('selectedModel', known)).toBe('credential.selectedModel');
    });
});

describe('customCredentialNames', () => {
    it('finds the custom credentials among the store\'s keys, sorted', () => {
        expect(customCredentialNames(['selectedModel', 'credential.Z_KEY', 'slackBotToken', 'credential.ALPHA'])).toEqual(['ALPHA', 'Z_KEY']);
    });
});

describe('CREDENTIAL_NAME', () => {
    it('takes letters, digits, _ . and -, and nothing else', () => {
        expect(['ALPHA_VANTAGE_KEY', 'brave-search.apiKey', 'key2'].every(name => CREDENTIAL_NAME.test(name))).toBe(true);
        expect(['', 'two words', 'a{b}', 'café'].some(name => CREDENTIAL_NAME.test(name))).toBe(false);
    });
});
