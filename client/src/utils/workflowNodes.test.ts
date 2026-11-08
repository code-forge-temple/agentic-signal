/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {AppNode} from '../components/nodes/workflow.gen';
import {NodeAssertions, workflowNodes} from './workflowNodes';


const node = (id: string, type: string, data: Record<string, unknown> = {}) => ({id, type, position: {x: 0, y: 0}, data}) as unknown as AppNode;
const dataOf = (nodes: AppNode[], id: string) => nodes.find(n => n.id === id)?.data as Record<string, unknown>;
const updates = workflowNodes({} as NodeAssertions);
const envelope = (payload: string) => ({payload});

describe('workflowNodes', () => {
    it('delivers an output to the nodes it feeds, dropping their pending feedback', () => {
        const nodes = [node('a', 'data-source'), node('b', 'llm-process', {feedback: 'retry'}), node('c', 'chart')];
        const result = updates.deliver(nodes, [{source: 'a', target: 'b'}], 'a', envelope('x'));

        expect(dataOf(result, 'b')).toEqual({input: envelope('x'), feedback: undefined});
        expect(result[2]).toBe(nodes[2]);
    });

    it('lets the aggregator collect one input per source, and take one back', () => {
        const feeds = [{source: 'a', target: 'g'}, {source: 'b', target: 'g'}];
        let nodes = [node('a', 'data-source'), node('b', 'data-source'), node('g', 'async-data-aggregator')];

        nodes = updates.deliver(nodes, feeds, 'a', envelope('1'));
        nodes = updates.deliver(nodes, feeds, 'b', envelope('2'));
        expect(dataOf(nodes, 'g').input).toEqual({a: envelope('1'), b: envelope('2')});

        nodes = updates.deliver(nodes, feeds, 'a', undefined);
        expect(dataOf(nodes, 'g').input).toEqual({b: envelope('2')});
    });

    it('takes back what came through cut edges: a whole input, or the aggregator\'s entry for that source', () => {
        const nodes = [
            node('t', 'chart', {input: envelope('x')}),
            node('g', 'async-data-aggregator', {input: {a: envelope('1'), b: envelope('2')}}),
            node('u', 'chart', {input: envelope('y')}),
        ];
        const result = updates.cut(nodes, [{source: 'a', target: 't'}, {source: 'a', target: 'g'}]);

        expect(dataOf(result, 't').input).toBeUndefined();
        expect(dataOf(result, 'g').input).toEqual({b: envelope('2')});
        expect(result[2]).toBe(nodes[2]);
    });

    it('sends feedback only to the LLM nodes feeding the node', () => {
        const nodes = [node('llm', 'llm-process'), node('src', 'data-source'), node('other', 'llm-process')];
        const feeds = [{source: 'llm', target: 'v'}, {source: 'src', target: 'v'}];
        const result = updates.sendFeedback(nodes, feeds, 'v', 'fix the JSON');

        expect(dataOf(result, 'llm').feedback).toBe('fix the JSON');
        expect(dataOf(result, 'src').feedback).toBeUndefined();
        expect(dataOf(result, 'other').feedback).toBeUndefined();
    });

    it('checks changed data with the node type\'s assertion', () => {
        const strict = workflowNodes({chart: () => {
            throw new Error('invalid');
        }} as unknown as NodeAssertions);

        expect(() => strict.configure([node('c', 'chart')], 'c', {title: 'x'})).toThrow('invalid');
    });
});
