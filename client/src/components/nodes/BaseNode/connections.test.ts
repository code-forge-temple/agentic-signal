/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it, vi} from 'vitest';
import type {Edge, Node} from '@xyflow/react';
import {inputConnects, outputConnects, portColor} from './connections';
import {NODE_PORT_COLORS} from '../../../constants';


const graph = (nodes: {id: string; type: string}[], edges: Partial<Edge>[] = []) => ({
    getNode: (id: string) => nodes.find(node => node.id === id) as Node | undefined,
    getEdges: () => edges as Edge[],
});
const flowEdge = (source: string, target: string) => ({source, target, sourceHandle: 'flow', targetHandle: 'flow'});
const NODES = [{id: 'me', type: 'data-source'}, {id: 'agg', type: 'async-data-aggregator'}, {id: 'llm', type: 'llm-process'}];

describe('portColor', () => {
    it('is the port\'s own color, else the flow color', () => {
        expect(portColor({color: 'red'})).toBe('red');
        expect(portColor({color: undefined})).toBeUndefined();

        for (const port of [true, false, undefined, {}]) expect(portColor(port)).toBe(NODE_PORT_COLORS.FLOW);
    });
});

describe('inputConnects', () => {
    it('takes one flow edge from another node, and none on other ports or from itself', () => {
        expect(inputConnects(true, 'me', flowEdge('llm', 'me'), graph(NODES))).toBe(true);
        expect(inputConnects(true, 'me', flowEdge('llm', 'me'), graph(NODES, [{target: 'me', targetHandle: 'flow'}]))).toBe(false);
        expect(inputConnects(true, 'me', flowEdge('llm', 'me'), graph(NODES, [{target: 'me', targetHandle: 'tool'}]))).toBe(true);
        expect(inputConnects(true, 'me', {...flowEdge('llm', 'me'), targetHandle: 'tool'}, graph(NODES))).toBe(false);
        expect(inputConnects(true, 'me', flowEdge('me', 'me'), graph(NODES))).toBe(false);
    });

    it('takes any number into an aggregator', () => {
        expect(inputConnects(true, 'agg', flowEdge('me', 'agg'), graph(NODES, [{target: 'agg', targetHandle: 'flow'}]))).toBe(true);
    });

    it('asks the port\'s own check instead, as a method of the port', () => {
        const port = {isValidConnection: vi.fn(function (this: unknown) { return this === port; })};

        expect(inputConnects(port, 'me', flowEdge('me', 'me'), graph(NODES))).toBe(true);
        expect(port.isValidConnection).toHaveBeenCalledWith(flowEdge('me', 'me'));
    });
});

describe('outputConnects', () => {
    it('goes to a node that takes another flow input, or one the flow doesn\'t have yet', () => {
        expect(outputConnects(true, flowEdge('me', 'llm'), graph(NODES))).toBe(true);
        expect(outputConnects(true, flowEdge('me', 'llm'), graph(NODES, [{target: 'llm', targetHandle: 'flow'}]))).toBe(false);
        expect(outputConnects(true, flowEdge('me', 'agg'), graph(NODES, [{target: 'agg', targetHandle: 'flow'}]))).toBe(true);
        expect(outputConnects(true, flowEdge('me', 'new'), graph(NODES, [{target: 'new', targetHandle: 'flow'}]))).toBe(true);
        expect(outputConnects(true, {...flowEdge('me', 'llm'), sourceHandle: null}, graph(NODES))).toBe(false);
    });

    it('asks the port\'s own check instead', () => {
        expect(outputConnects({isValidConnection: () => false}, flowEdge('me', 'llm'), graph(NODES))).toBe(false);
    });
});
