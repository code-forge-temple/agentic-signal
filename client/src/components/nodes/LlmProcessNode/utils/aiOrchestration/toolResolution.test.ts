/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {buildToolsDescription, resolveTaskTools} from './toolResolution';
import {AgentTask, OrchestrationParams} from './types';

function makeTool (name: string, description?: string, requireToolUse = true): NonNullable<OrchestrationParams['tools']>[number] {
    return {
        schema: {name, description, parameters: {} as any},
        systemUserConfigValues: {requireToolUse},
        handler: async () => ({success: true}),
    };
}

describe('buildToolsDescription', () => {
    it('returns an empty string when there are no tools', () => {
        expect(buildToolsDescription(undefined)).toBe('');
        expect(buildToolsDescription([])).toBe('');
    });

    it('lists each tool name and description', () => {
        const description = buildToolsDescription([
            makeTool('braveSearch', 'Searches the web'),
            makeTool('formInteraction'),
        ]);

        expect(description).toContain('braveSearch: Searches the web');
        expect(description).toContain('formInteraction');
        expect(description).toContain('Available tools');
    });
});

describe('resolveTaskTools', () => {
    const allTools = [makeTool('formInteraction'), makeTool('braveSearch')];

    it('returns undefined when there are no tools at all', () => {
        const task: AgentTask = {content: 'x', tools: ['formInteraction']};

        expect(resolveTaskTools(task, undefined)).toBeUndefined();
        expect(resolveTaskTools(task, [])).toBeUndefined();
    });

    it('returns undefined when the task requests no tools', () => {
        expect(resolveTaskTools({content: 'x'}, allTools)).toBeUndefined();
        expect(resolveTaskTools({content: 'x', tools: []}, allTools)).toBeUndefined();
    });

    it('resolves an exact tool name match', () => {
        const resolved = resolveTaskTools({content: 'x', tools: ['formInteraction']}, allTools);

        expect(resolved).toHaveLength(1);
        expect(resolved![0].schema.name).toBe('formInteraction');
    });

    it('resolves a case-insensitive match', () => {
        const resolved = resolveTaskTools({content: 'x', tools: ['FORMINTERACTION']}, allTools);

        expect(resolved).toHaveLength(1);
        expect(resolved![0].schema.name).toBe('formInteraction');
    });

    it('resolves a normalized match (punctuation/separators stripped)', () => {
        const resolved = resolveTaskTools({content: 'x', tools: ['form-interaction!']}, allTools);

        expect(resolved).toHaveLength(1);
        expect(resolved![0].schema.name).toBe('formInteraction');
    });

    it('ignores a genuinely unresolvable tool name rather than throwing', () => {
        const resolved = resolveTaskTools({content: 'x', tools: ['totallyUnknownTool']}, allTools);

        expect(resolved).toBeUndefined();
    });

    it('resolves the valid names and drops only the unresolvable ones from a mixed list', () => {
        const resolved = resolveTaskTools({content: 'x', tools: ['formInteraction', 'nope']}, allTools);

        expect(resolved).toHaveLength(1);
        expect(resolved![0].schema.name).toBe('formInteraction');
    });

    it('de-duplicates when the planner lists the same tool twice', () => {
        const resolved = resolveTaskTools({content: 'x', tools: ['formInteraction', 'FORMINTERACTION']}, allTools);

        expect(resolved).toHaveLength(1);
    });

    it('preserves the original tool object (including requireToolUse) unchanged', () => {
        const requiredTool = makeTool('formInteraction', undefined, true);
        const resolved = resolveTaskTools({content: 'x', tools: ['formInteraction']}, [requiredTool]);

        expect(resolved![0]).toBe(requiredTool);
        expect(resolved![0].systemUserConfigValues.requireToolUse).toBe(true);
    });
});
