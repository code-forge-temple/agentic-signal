/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {assertValidWorkflowEdges, getExpectedEdgeHandle} from './workflowUtils';
import {NODE_PORT_IDS} from '../../../constants';


const nodes = [
    {id: 'timer', type: 'timer'},
    {id: 'tool', type: 'ai-tool'},
    {id: 'rag', type: 'rag'},
    {id: 'llm', type: 'llm-process'},
    {id: 'src', type: 'data-source'},
    {id: 'src2', type: 'data-source'},
    {id: 'http', type: 'http-data'},
    {id: 'agg', type: 'async-data-aggregator'},
];
const edge = (source: string, target: string, handle?: string, id?: string) =>
    ({id, source, target, ...(handle ? {sourceHandle: handle, targetHandle: handle} : {})});
const problem = (edges: Parameters<typeof assertValidWorkflowEdges>[1]) => {
    try {
        assertValidWorkflowEdges(nodes, edges);

        return '';
    } catch (error) {
        return (error as Error).message;
    }
};

describe('getExpectedEdgeHandle', () => {
    it('is the trigger port for a timer, the tool port for a tool, the context port for RAG, else flow, in that order', () => {
        expect(getExpectedEdgeHandle('timer', 'ai-tool')).toBe(NODE_PORT_IDS.TRIGGER);
        expect(getExpectedEdgeHandle('llm-process', 'timer')).toBe(NODE_PORT_IDS.TRIGGER);
        expect(getExpectedEdgeHandle('ai-tool', 'rag')).toBe(NODE_PORT_IDS.TOOL);
        expect(getExpectedEdgeHandle('rag', 'llm-process')).toBe(NODE_PORT_IDS.CONTEXT);
        expect(getExpectedEdgeHandle('data-source', 'llm-process')).toBe(NODE_PORT_IDS.FLOW);
    });
});

describe('assertValidWorkflowEdges', () => {
    it('accepts edges on the right ports, and skips edges to nodes it doesn\'t have', () => {
        expect(problem([
            edge('timer', 'src', NODE_PORT_IDS.TRIGGER),
            edge('tool', 'llm', NODE_PORT_IDS.TOOL),
            edge('rag', 'llm', NODE_PORT_IDS.CONTEXT),
            edge('src', 'llm'),
            edge('ghost', 'llm', 'anything'),
        ])).toBe('');
    });

    it('lets RAG and tool nodes connect only to an LLM process node', () => {
        expect(problem([edge('rag', 'src', NODE_PORT_IDS.CONTEXT)])).toBe('Invalid workflow import: edges involving a RAG node must connect only to an LLM process node.');
        expect(problem([edge('src', 'tool', NODE_PORT_IDS.TOOL)])).toBe('Invalid workflow import: edges involving a tool node must connect only to an LLM process node.');
        // RAG is checked first.
        expect(problem([edge('rag', 'tool')])).toMatch(/RAG node/);
    });

    it('names the edge and the port it should use (by id, else by its ends)', () => {
        expect(problem([edge('timer', 'src', undefined, 'e1')])).toBe('Invalid workflow import: edge "e1" between "timer" and "data-source" must use handle "trigger".');
        expect(problem([{source: 'src', target: 'llm', sourceHandle: 'flow', targetHandle: 'tool'}]))
            .toBe('Invalid workflow import: edge "src-llm" between "data-source" and "llm-process" must use handle "flow".');
    });

    it('allows one incoming flow edge per node, any number into an aggregator, and other ports aside', () => {
        expect(problem([edge('src', 'agg'), edge('src2', 'agg'), edge('http', 'agg')])).toBe('');
        expect(problem([edge('timer', 'http', NODE_PORT_IDS.TRIGGER), edge('src', 'http')])).toBe('');
        expect(problem([edge('src', 'http'), edge('src2', 'http')]))
            .toBe('Invalid workflow import: node "http" has multiple incoming "flow" edges. Only async data aggregator nodes may receive multiple "flow" inputs.');
    });
});
