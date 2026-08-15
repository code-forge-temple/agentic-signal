/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {buildAggregationMessage, buildDependencyContext} from './messageBuilders';
import {AgentTask, AgentTaskResult} from './types';

describe('buildDependencyContext', () => {
    const priorResults: AgentTaskResult[] = [
        {task: {content: 'Task 1 content'}, response: 'Task 1 response'},
        {task: {content: 'Task 2 content'}, response: 'Task 2 response'},
    ];

    it('returns an empty string when the task has no dependencies', () => {
        expect(buildDependencyContext({content: 'x'}, 2, priorResults)).toBe('');
        expect(buildDependencyContext({content: 'x', dependsOn: []}, 2, priorResults)).toBe('');
    });

    it('injects the output of a single valid backward dependency', () => {
        const task: AgentTask = {content: 'x', dependsOn: [0]};
        const context = buildDependencyContext(task, 2, priorResults);

        expect(context).toContain('Output of Task 1');
        expect(context).toContain('Task 1 response');
        expect(context).not.toContain('Task 2 response');
        expect(context).toContain('[YOUR TASK]');
    });

    it('injects multiple dependencies in order', () => {
        const task: AgentTask = {content: 'x', dependsOn: [0, 1]};
        const context = buildDependencyContext(task, 2, priorResults);

        const firstIndex = context.indexOf('Task 1 response');
        const secondIndex = context.indexOf('Task 2 response');

        expect(firstIndex).toBeGreaterThanOrEqual(0);
        expect(secondIndex).toBeGreaterThan(firstIndex);
    });

    it('silently drops forward/invalid references, keeping only valid ones', () => {
        // taskIndex is 1 here, so index 1 (itself) and 5 (out of range) are invalid;
        // only index 0 is a valid backward reference.
        const task: AgentTask = {content: 'x', dependsOn: [0, 1, 5]};
        const context = buildDependencyContext(task, 1, priorResults);

        expect(context).toContain('Task 1 response');
        expect(context).not.toContain('Task 2 response');
    });

    it('returns an empty string when every reference is invalid', () => {
        const task: AgentTask = {content: 'x', dependsOn: [5, -1]};

        expect(buildDependencyContext(task, 1, priorResults)).toBe('');
    });
});

describe('buildAggregationMessage', () => {
    it('formats a single task result', () => {
        const results: AgentTaskResult[] = [{task: {content: 'Do X'}, response: 'X done'}];
        const message = buildAggregationMessage(results);

        expect(message).toContain('Task 1');
        expect(message).toContain('Do X');
        expect(message).toContain('X done');
        expect(message).toContain('Synthesize them into a final comprehensive response');
    });

    it('formats multiple task results in order', () => {
        const results: AgentTaskResult[] = [
            {task: {content: 'Do X'}, response: 'X done'},
            {task: {content: 'Do Y'}, response: 'Y done'},
        ];
        const message = buildAggregationMessage(results);
        const xIndex = message.indexOf('X done');
        const yIndex = message.indexOf('Y done');

        expect(message).toContain('Task 1');
        expect(message).toContain('Task 2');
        expect(yIndex).toBeGreaterThan(xIndex);
    });
});
