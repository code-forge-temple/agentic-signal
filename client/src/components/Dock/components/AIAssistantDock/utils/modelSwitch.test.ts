/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {ROLE} from '../../../../../constants';
import {ChatEntry, NOTICE_ROLE} from '../constants';
import {withModelSwitch} from './modelSwitch';


const user: ChatEntry = {role: ROLE.USER, content: 'hi'};
const reply: ChatEntry = {role: ROLE.ASSISTANT, content: 'hello'};
const switched = (model: string, previousModel: string): ChatEntry => ({role: NOTICE_ROLE, model, previousModel});

describe('withModelSwitch', () => {
    it('adds a line after a message', () => {
        expect(withModelSwitch([user, reply], 'b', 'a')).toEqual([user, reply, switched('b', 'a')]);
    });

    it('updates the line when another switch follows it', () => {
        expect(withModelSwitch([user, reply, switched('b', 'a')], 'c', 'b')).toEqual([user, reply, switched('c', 'a')]);
    });

    it('removes the line when switching straight back', () => {
        expect(withModelSwitch([user, reply, switched('b', 'a')], 'a', 'b')).toEqual([user, reply]);
    });

    it('adds nothing to an empty chat', () => {
        expect(withModelSwitch([], 'b', 'a')).toEqual([]);
    });
});
