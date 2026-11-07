/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {beforeEach, describe, expect, it, vi} from 'vitest';
import {findWorkflowJson} from './workflowJson';
import {sanitizeJsonInput} from '../../../../nodes/ToolNode/tools/utils/sanitize';

// The forgiving parser (dirty-json) behind sanitizeJsonInput is the slow part: spied on.
vi.mock('../../../../nodes/ToolNode/tools/utils/sanitize', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../../nodes/ToolNode/tools/utils/sanitize')>();

    return {...original, sanitizeJsonInput: vi.fn(original.sanitizeJsonInput)};
});

// Each test has its own text: answers are remembered per block across tests too.
const workflow = (id: string) => JSON.stringify({nodes: [{id, type: 'timer'}], edges: []});
const withTrailingComma = (id: string) => `{"nodes": [{"id": "${id}", "type": "timer"},], "edges": []}`;

describe('findWorkflowJson', () => {
    beforeEach(() => {
        vi.mocked(sanitizeJsonInput).mockClear();
    });

    it('reads valid JSON with the browser\'s parser alone', () => {
        expect(JSON.parse(findWorkflowJson(workflow('valid'))!)).toMatchObject({nodes: [{id: 'valid'}]});
        expect(sanitizeJsonInput).not.toHaveBeenCalled();
    });

    it('unwraps a workflow given under "workflow"', () => {
        const wrapped = JSON.stringify({workflow: {nodes: [{id: 'wrapped'}], edges: []}});

        expect(JSON.parse(findWorkflowJson(wrapped)!)).toEqual({nodes: [{id: 'wrapped'}], edges: []});
    });

    it('falls back to the forgiving parser for JSON with a trailing comma', () => {
        expect(JSON.parse(findWorkflowJson(withTrailingComma('comma'))!)).toMatchObject({nodes: [{id: 'comma'}]});
        expect(sanitizeJsonInput).toHaveBeenCalledTimes(1);
    });

    it('remembers each block\'s answer, so the forgiving parser runs once per block', () => {
        const block = withTrailingComma('twice');

        findWorkflowJson(block);
        findWorkflowJson(block);

        expect(sanitizeJsonInput).toHaveBeenCalledTimes(1);
    });

    it('answers null for JSON that isn\'t a workflow', () => {
        expect(findWorkflowJson('{"title": "not a workflow"}')).toBeNull();
    });

    it('answers null for code that isn\'t JSON, without trying to parse it', () => {
        expect(findWorkflowJson('print("hello")')).toBeNull();
        expect(sanitizeJsonInput).not.toHaveBeenCalled();
    });
});
