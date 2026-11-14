/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {passwordProblem, vaultIntro, vaultOpenError} from './utils';
import {WrongPasswordError} from '../../services/vault/crypto';
import {MIN_PASSWORD_LENGTH} from '../../services/vault/vault';


describe('passwordProblem', () => {
    const long = 'x'.repeat(MIN_PASSWORD_LENGTH);

    it('wants a new password long enough and repeated the same, length first', () => {
        expect(passwordProblem(true, 'x', 'y')).toBe(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
        expect(passwordProblem(true, long, `${long}!`)).toBe("The two passwords don't match.");
        expect(passwordProblem(true, long, long)).toBeNull();
    });

    it('says nothing when unlocking', () => {
        expect(passwordProblem(false, '', 'other')).toBeNull();
    });
});

describe('vaultIntro and vaultOpenError', () => {
    it('says why a save opened the popup, then what the password does', () => {
        expect(vaultIntro('create', 'connection')).toMatch(/^Before the outside connection is saved, .* Saved credentials and outside connections' tokens are encrypted/);
        expect(vaultIntro('create', null)).toMatch(/^Saved credentials/);
        expect(vaultIntro('unlock', 'credential')).toMatch(/^Your saved credentials and outside connections' tokens are encrypted\./);
        expect(vaultIntro(null, null)).toBe('');
    });

    it('names a wrong password, and any other failure', () => {
        expect(vaultOpenError(new WrongPasswordError())).toBe('Wrong password.');
        expect(vaultOpenError(new Error('disk full'))).toBe("Couldn't open the vault: disk full");
    });
});
