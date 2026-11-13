/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {outsideCommandFailure} from './outsideCommandsService';
import {CommandError} from './commandRouter';


const KNOWN = new Set(['research']);

describe('outsideCommandFailure', () => {
    it('calls a command nothing listens for and no workflow has unknown', () => {
        expect(outsideCommandFailure(new CommandError('no_listener', 'none'), 'nope', KNOWN))
            .toEqual({code: 'unknown_command', message: 'No workflow answers to /nope.'});
    });

    it('passes on the router\'s code for a known command, and the node that failed', () => {
        expect(outsideCommandFailure(new CommandError('no_listener', 'Not running now.'), 'research', KNOWN))
            .toEqual({code: 'no_listener', message: 'Not running now.', node: null});

        const failed = new CommandError('node_failed', 'Search failed', {nodeId: 'n1', nodeType: 'llm', nodeTitle: 'AI Data Processing', message: 'x'});

        expect(outsideCommandFailure(failed, 'research', KNOWN)).toEqual({code: 'node_failed', message: 'Search failed', node: 'AI Data Processing'});
    });

    it('calls any other error node_failed', () => {
        expect(outsideCommandFailure(new Error('boom'), 'research', KNOWN)).toEqual({code: 'node_failed', message: 'boom', node: null});
    });
});
