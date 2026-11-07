/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {findWorkflowCommand, normalizeCommand, withDefaultModel} from './commands';
import {BUILTIN_COMMAND_WORKFLOWS, commandWorkflowsFrom, workflowFileName} from '.';


describe('normalizeCommand', () => {
    it('drops a leading slash, spaces and capitals', () => {
        expect(normalizeCommand(' /Research ')).toBe('research');
        expect(normalizeCommand('daily-report2')).toBe('daily-report2');
    });

    it('returns empty for anything that isn\'t a command name', () => {
        expect(normalizeCommand('')).toBe('');
        expect(normalizeCommand('two words')).toBe('');
        expect(normalizeCommand('-leading')).toBe('');
        expect(normalizeCommand('a_b')).toBe('');
    });
});

describe('findWorkflowCommand', () => {
    it('reads the command and description from the Workflow Input', () => {
        const workflow = {nodes: [
            {type: 'llm-process', data: {}},
            {type: 'workflow-input', data: {command: '/Bees', description: 'About bees'}},
        ]};

        expect(findWorkflowCommand(workflow)).toEqual({command: 'bees', description: 'About bees'});
    });

    it('returns null without a Workflow Input with a valid command', () => {
        expect(findWorkflowCommand({nodes: [{type: 'workflow-input', data: {command: 'not valid'}}]})).toBeNull();
        expect(findWorkflowCommand({nodes: [{type: 'data-source', data: {}}]})).toBeNull();
        expect(findWorkflowCommand('nonsense')).toBeNull();
    });
});

describe('withDefaultModel', () => {
    it('fills only the LLM nodes that name no model', () => {
        const workflow = {nodes: [
            {type: 'llm-process', data: {model: ''}},
            {type: 'llm-process', data: {model: 'chosen'}},
            {type: 'data-source', data: {}},
        ]};

        expect(withDefaultModel(workflow, 'buddy-model')).toEqual({nodes: [
            {type: 'llm-process', data: {model: 'buddy-model'}},
            {type: 'llm-process', data: {model: 'chosen'}},
            {type: 'data-source', data: {}},
        ]});
    });
});

const savedFile = (name: string, command: string, description = '') => ({
    name,
    content: JSON.stringify({nodes: [{type: 'workflow-input', data: {command, description}}]}),
});

describe('commandWorkflowsFrom', () => {
    it('adds saved workflows to the built-ins, sorted by command', () => {
        const commands = commandWorkflowsFrom([savedFile('Echo.json', 'echo', 'Shouts back')]);

        expect(commands.map(c => c.command)).toEqual(['convert', 'crypto', 'echo', 'holidays', 'research', 'summarize', 'weather']);
        expect(commands.find(c => c.command === 'echo')).toMatchObject({description: 'Shouts back', file: 'Echo.json'});
    });

    it('lets a saved workflow replace a built-in answering to the same command', () => {
        const research = commandWorkflowsFrom([savedFile('My research.json', 'research', 'Mine')]).find(c => c.command === 'research');

        expect(research).toMatchObject({description: 'Mine', file: 'My research.json'});
    });

    it('keeps the first file by name when two answer to one command, and skips files without a command or valid JSON', () => {
        const commands = commandWorkflowsFrom([
            savedFile('a.json', 'echo', 'first'),
            savedFile('b.json', 'echo', 'second'),
            {name: 'plain.json', content: JSON.stringify({nodes: [{type: 'data-source', data: {}}]})},
            {name: 'broken.json', content: '{oops'},
        ]);

        expect(commands.filter(c => c.command === 'echo')).toHaveLength(1);
        expect(commands.find(c => c.command === 'echo')?.description).toBe('first');
        expect(commands.map(c => c.command)).toEqual(['convert', 'crypto', 'echo', 'holidays', 'research', 'summarize', 'weather']);
    });
});

describe('workflowFileName', () => {
    it('turns a layer name into a file name the backend accepts', () => {
        expect(workflowFileName('Layer 1')).toBe('Layer 1.json');
        expect(workflowFileName('Research: bees/wasps')).toBe('Research- bees-wasps.json');
        expect(workflowFileName('  ..hidden')).toBe('hidden.json');
        expect(workflowFileName('report.json')).toBe('report.json');
        expect(workflowFileName('!!!')).toBe('workflow.json');
    });
});

describe('BUILTIN_COMMAND_WORKFLOWS', () => {
    it('includes /research with its description', () => {
        expect(BUILTIN_COMMAND_WORKFLOWS.map(w => w.command)).toContain('research');
        expect(BUILTIN_COMMAND_WORKFLOWS.find(w => w.command === 'research')?.description).toMatch(/web/);
    });
});
