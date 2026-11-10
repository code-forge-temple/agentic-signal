/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {
    chatCommandsPrompt,
    commandFailureText,
    commandReplySystemPrompt,
    commandResultsMessage,
    formatUtcOffset,
    messageTimeStamp,
    parseCommandMessage,
    parseCommandSuggestion,
    resolveCommand,
    toModelMessages,
} from './chatCommands';
import {CommandError} from '../../../../../services/commandRouter';


describe('parseCommandMessage', () => {
    it('reads the command and the text after it', () => {
        expect(parseCommandMessage('/research  quantum error correction ')).toEqual({command: 'research', text: 'quantum error correction'});
    });

    it('allows leading spaces and capitals', () => {
        expect(parseCommandMessage('   /Research bees')).toEqual({command: 'research', text: 'bees'});
    });

    it('returns empty text for a bare command', () => {
        expect(parseCommandMessage('/daily-report')).toEqual({command: 'daily-report', text: ''});
        expect(parseCommandMessage('/daily-report   ')).toEqual({command: 'daily-report', text: ''});
    });

    it('ignores ordinary messages, including a / that does not open the message', () => {
        expect(parseCommandMessage('tell me about bees')).toBeNull();
        expect(parseCommandMessage('please /research bees')).toBeNull();
        expect(parseCommandMessage('/ research')).toBeNull();
    });
});

describe('resolveCommand', () => {
    const workflows = [{command: 'weather', description: 'w'}, {command: 'crypto', description: 'c'}];

    it('finds the workflow that answers to the command, with the text after it', () => {
        expect(resolveCommand('/weather New York', workflows)).toEqual({command: 'weather', text: 'New York', workflow: workflows[0]});
    });

    it('names a command no workflow answers to, with no workflow', () => {
        expect(resolveCommand('/nope now', workflows)).toEqual({command: 'nope', text: 'now', workflow: undefined});
    });

    it('is null for an ordinary message', () => {
        expect(resolveCommand('what is the weather?', workflows)).toBeNull();
    });
});

describe('commandReplySystemPrompt', () => {
    it('names the command and what it does', () => {
        const prompt = commandReplySystemPrompt('research', 'Research a topic on the web and report back, with sources.', 'bees');

        expect(prompt).toContain('/research (Research a topic on the web and report back, with sources)');
    });

    it('names the request it answers, so an earlier question in the chat isn\'t taken for it', () => {
        expect(commandReplySystemPrompt('research', '', 'universal basic income')).toContain('for the user\'s request "/research universal basic income"');
        expect(commandReplySystemPrompt('research', '', 'universal basic income')).toContain('Answer that request from it');
    });

    it('leaves the description and the text out when there are none', () => {
        expect(commandReplySystemPrompt('ping', '', '')).toContain('the workflow /ping for the user\'s request "/ping"');
    });
});

describe('commandResultsMessage', () => {
    it('passes a text result through, introduced with the command and what was asked', () => {
        const message = commandResultsMessage('research', 'bees', {payload: '# Bees\nThey dance.'}, 4096);

        expect(message).toContain('/research for "bees"');
        expect(message).toMatch(/# Bees\nThey dance\.$/);
    });

    it('writes a structured result out as JSON', () => {
        expect(commandResultsMessage('x', '', {payload: {findings: ['a']}}, 4096)).toContain('"findings": [');
    });

    it('cuts a result too long for the context window, and says so', () => {
        // 100 tokens leave room for 100 * 0.5 * 3 = 150 characters.
        const message = commandResultsMessage('x', '', {payload: 'a'.repeat(1000)}, 100);

        expect(message).toContain('a'.repeat(150));
        expect(message).not.toContain('a'.repeat(151));
        expect(message).toMatch(/cut to fit the model's context window\]$/);
    });
});

describe('toModelMessages', () => {
    it('puts the results of a command just before its reply, as a user message', () => {
        expect(toModelMessages([
            {role: 'user', content: '/research bees'},
            {role: 'assistant', content: 'Bees pollinate.', thinking: 'hmm', commandResults: {label: 'Results of /research', content: 'Results: bees'}},
            {role: 'user', content: 'and wasps?'},
        ])).toEqual([
            {role: 'user', content: '/research bees'},
            {role: 'user', content: 'Results: bees'},
            {role: 'assistant', content: 'Bees pollinate.'},
            {role: 'user', content: 'and wasps?'},
        ]);
    });

    it('leaves out a reply that has no text yet, but not its results', () => {
        expect(toModelMessages([
            {role: 'user', content: '/research bees'},
            {role: 'assistant', content: '', commandResults: {label: 'Results of /research', content: 'Results: bees'}},
        ])).toEqual([
            {role: 'user', content: '/research bees'},
            {role: 'user', content: 'Results: bees'},
        ]);
    });

    it('leaves out a model switch', () => {
        expect(toModelMessages([
            {role: 'user', content: 'hi'},
            {role: 'notice', model: 'gemma4:31b-cloud', previousModel: 'llama3:latest'},
            {role: 'user', content: 'and now?'},
        ])).toEqual([
            {role: 'user', content: 'hi'},
            {role: 'user', content: 'and now?'},
        ]);
    });

    it('stamps the user\'s messages with when they were sent, and nothing else', () => {
        const sentAt = new Date(2026, 10, 1, 14, 3).getTime();
        const stamp = messageTimeStamp(sentAt);

        expect(toModelMessages([
            {role: 'user', content: '/holidays Cyprus', sentAt},
            {role: 'assistant', content: 'Christmas Eve is next.', commandResults: {label: 'Results of /holidays', content: 'Results: holidays'}},
        ])).toEqual([
            {role: 'user', content: `${stamp} /holidays Cyprus`},
            {role: 'user', content: 'Results: holidays'},
            {role: 'assistant', content: 'Christmas Eve is next.'},
        ]);
    });
});

describe('messageTimeStamp', () => {
    it('gives the weekday, date, time and time zone, in the user\'s time zone', () => {
        const date = new Date(2026, 10, 1, 14, 3);

        expect(messageTimeStamp(date.getTime())).toBe(`[Sun 1 Nov 2026, 14:03 ${formatUtcOffset(-date.getTimezoneOffset())}]`);
    });

    it('pads hours and minutes', () => {
        expect(messageTimeStamp(new Date(2027, 0, 9, 7, 5).getTime())).toMatch(/^\[Sat 9 Jan 2027, 07:05 GMT/);
    });
});

describe('formatUtcOffset', () => {
    it('writes whole hours, half hours and Greenwich itself', () => {
        expect(formatUtcOffset(120)).toBe('GMT+2');
        expect(formatUtcOffset(-240)).toBe('GMT-4');
        expect(formatUtcOffset(330)).toBe('GMT+5:30');
        expect(formatUtcOffset(-570)).toBe('GMT-9:30');
        expect(formatUtcOffset(0)).toBe('GMT');
    });
});

describe('commandFailureText', () => {
    it('names the node a run failed at, when the error says', () => {
        const error = new CommandError('node_failed', 'failed', {nodeId: 'n1', nodeType: 'get-data', nodeTitle: 'GET Data', message: 'HTTP 404'});

        expect(commandFailureText('crypto', error)).toBe('/crypto failed at **GET Data**: HTTP 404');
    });

    it('gives the error\'s own message otherwise', () => {
        expect(commandFailureText('research', new Error('The AI Buddy layer isn\'t ready.'))).toBe('/research failed: The AI Buddy layer isn\'t ready.');
    });
});

describe('chatCommandsPrompt', () => {
    const prompt = chatCommandsPrompt([
        {command: 'research', description: 'Research a topic on the web and report back, with sources.'},
        {command: 'echo', description: ''},
    ]);

    it('lists the commands with what they do', () => {
        expect(prompt).toContain('- /research: Research a topic on the web and report back, with sources.');
        expect(prompt).toContain('- /echo\n');
    });

    it('asks for the answer first, then at most one suggestion, in a command block at the end', () => {
        expect(prompt).toContain('Answer first from what you have');
        expect(prompt).toContain('Suggest at most one, as the very last thing in the reply');
        expect(prompt).toContain('```command\n/research universal basic income and AI-driven job displacement\n```');
    });
});

describe('parseCommandSuggestion', () => {
    const commands = ['research', 'weather'];

    it('reads a command block naming a known command, as the message running it sends', () => {
        expect(parseCommandSuggestion('/research UBI and AI job loss\n', 'command', commands))
            .toEqual({command: 'research', text: 'UBI and AI job loss', message: '/research UBI and AI job loss'});
    });

    it('takes the block\'s language in any case', () => {
        expect(parseCommandSuggestion('/weather New York', 'Command', commands)?.command).toBe('weather');
    });

    it('leaves other blocks as code: another language, an unknown command, no command, or more than one line', () => {
        expect(parseCommandSuggestion('/research UBI', 'bash', commands)).toBeNull();
        expect(parseCommandSuggestion('/research UBI', undefined, commands)).toBeNull();
        expect(parseCommandSuggestion('/nosuch thing', 'command', commands)).toBeNull();
        expect(parseCommandSuggestion('research UBI', 'command', commands)).toBeNull();
        expect(parseCommandSuggestion('/research UBI\n/weather New York', 'command', commands)).toBeNull();
    });
});
