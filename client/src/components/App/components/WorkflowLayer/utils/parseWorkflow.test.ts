/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {describeLoadError, parseWorkflowJson} from './parseWorkflow';
import {DEFAULT_EDGE_TYPE} from '../../../../edges';
import {toolRegistry} from '../../../../nodes/ToolNode/tools/toolRegistry.gen';
import {nodeRegistry} from '../../../../nodes/nodeRegistry.gen';
import convert from '../../../../../workflows/builtin/convert.json';
import cryptoAnalysis from '../../../../../workflows/builtin/crypto.json';
import holidays from '../../../../../workflows/builtin/holidays.json';
import research from '../../../../../workflows/builtin/research.json';
import summarize from '../../../../../workflows/builtin/summarize.json';
import weather from '../../../../../workflows/builtin/weather.json';


type RawNode = {id: string; type: string; position?: {x?: number; y?: number}; data: Record<string, unknown>};

const descriptorOf = (type: string) => nodeRegistry.find(descriptor => descriptor.type === type)!;
const toolOf = (subtype: string) => toolRegistry.find(tool => tool.toolSubtype === subtype)!;
const parse = (workflow: unknown) => parseWorkflowJson(JSON.stringify(workflow));
const errorOf = (run: () => unknown) => {
    try {
        run();
    } catch (error) {
        return error;
    }

    throw new Error('expected a throw');
};

const dataSource = (id: string, extra: Partial<RawNode> = {}): RawNode => ({
    id,
    type: 'data-source',
    position: {x: 10, y: 20},
    data: {title: 'Mine', dataSource: {type: 'markdown-and-files', value: {text: 'hi', files: []}}},
    ...extra,
});

describe('parseWorkflowJson', () => {
    it.each(Object.entries({convert, cryptoAnalysis, holidays, research, summarize, weather}))('loads the built-in %s workflow', (_, workflow) => {
        const {nodes, edges} = parse(workflow);
        const oldIds = new Set(workflow.nodes.map(node => node.id));
        const newIds = new Set(nodes.map(node => node.id));

        expect(nodes).toHaveLength(workflow.nodes.length);
        expect(newIds.size).toBe(nodes.length);
        expect(nodes.every(node => !oldIds.has(node.id))).toBe(true);
        expect(edges).toHaveLength(workflow.edges.length);
        expect(edges.every(edge => newIds.has(edge.source) && newIds.has(edge.target))).toBe(true);
        expect(edges.every(edge => edge.type === DEFAULT_EDGE_TYPE)).toBe(true);
    });

    it('gives every node a fresh id, and every edge new ends and an id made of them', () => {
        const {nodes, edges} = parse({
            nodes: [dataSource('a'), {...dataSource('b'), type: 'data-flow-spy', data: {}}],
            edges: [{source: 'a', target: 'b', sourceHandle: 'flow', targetHandle: 'flow'}],
        });
        const [a, b] = nodes;

        expect(a.id).not.toBe('a');
        expect(edges).toEqual([expect.objectContaining({source: a.id, target: b.id, id: `xy-edge__${a.id}flow-${b.id}flow`})]);
    });

    it('places a node with no position by its index, and keeps the half of a position it has', () => {
        const {nodes} = parse({nodes: [dataSource('a'), dataSource('b', {position: undefined}), dataSource('c', {position: {x: 5}})]});

        expect(nodes.map(node => node.position)).toEqual([{x: 10, y: 20}, {x: 300, y: 0}, {x: 5, y: 0}]);
    });

    it('takes no edges as none', () => {
        expect(parse({nodes: [dataSource('a')]}).edges).toEqual([]);
    });

    it('gives a node its default title and the paths to sanitize, keeping the rest of its data', () => {
        const [node] = parse({nodes: [dataSource('a')]}).nodes;
        const {defaultData} = descriptorOf('data-source');

        expect(node.data.title).toBe(defaultData.title);
        expect(node.data.toSanitize).toEqual(defaultData.toSanitize);
        expect(node.data).toMatchObject({dataSource: {type: 'markdown-and-files', value: {text: 'hi'}}});
    });

    it('migrates old data through the descriptor', () => {
        const old = dataSource('a', {data: {dataSource: {type: 'markdown', value: {text: 'hi', files: []}}}});
        const [node] = parse({nodes: [old]}).nodes;

        expect(node.data).toMatchObject({dataSource: {type: 'markdown-and-files'}});
    });

    it('fills a known tool from the registry: schema, title, defaults under the saved config, no handler', () => {
        const tool = toolOf('duckduckgo-search');
        const data = {toolSubtype: 'duckduckgo-search', userConfig: {maxResults: 3}, handler: 'x'};
        const [node] = parse({nodes: [{id: 't', type: 'ai-tool', position: {x: 0, y: 0}, data}]}).nodes;

        expect(node.data).toMatchObject({
            toolSchema: tool.toolSchema,
            userConfigSchema: tool.userConfigSchema,
            title: tool.title,
            handler: undefined,
            toSanitize: [...descriptorOf('ai-tool').defaultData.toSanitize ?? [], ...tool.toSanitize],
        });
        expect(node.data).toMatchObject({userConfig: {maxResults: 3}});
    });

    it('adds a tool\'s own paths to sanitize after the node\'s', () => {
        const tool = toolRegistry.find(entry => entry.toSanitize.length > 0)!;
        const [node] = parse({nodes: [{id: 't', type: 'ai-tool', position: {x: 0, y: 0}, data: {toolSubtype: tool.toolSubtype}}]}).nodes;

        expect(node.data.toSanitize).toEqual([...descriptorOf('ai-tool').defaultData.toSanitize ?? [], ...tool.toSanitize]);
    });

    it('loads a tool missing from the registry with an empty schema and the node\'s defaults', () => {
        const [node] = parse({nodes: [{id: 't', type: 'ai-tool', position: {x: 0, y: 0}, data: {toolSubtype: 'gone-tool', userConfig: {a: 1}}}]}).nodes;
        const {defaultData} = descriptorOf('ai-tool');

        expect(node.data).toMatchObject({toolSchema: {}, title: defaultData.title, handler: undefined, toSanitize: defaultData.toSanitize, userConfig: {a: 1}});
    });

    it('rejects an unknown node type, listing the valid ones', () => {
        const error = errorOf(() => parse({nodes: [{...dataSource('a'), type: 'no-such-node'}]})) as Error;

        expect(error.message).toMatch(/^unknown node type "no-such-node"\. Valid types are: /);
        expect(error.message).toContain('data-source');
    });

    it('names the node and the field when a node\'s data is invalid', () => {
        const error = errorOf(() => parse({nodes: [dataSource('a'), {id: 'l', type: 'llm-process', position: {x: 0, y: 0}, data: {model: 5}}]})) as Error;

        expect(error.message).toMatch(/^nodes\[1\] \(type "llm-process"\): data→model: /);
    });

    it('checks the edges between the nodes it has, and lets one to a missing node through as it is', () => {
        const tool = {id: 't', type: 'ai-tool', position: {x: 0, y: 0}, data: {toolSubtype: 'max'}};

        expect(() => parse({nodes: [dataSource('a'), tool], edges: [{source: 't', target: 'a', sourceHandle: 'tool', targetHandle: 'tool'}]}))
            .toThrow('edges involving a tool node must connect only to an LLM process node');
        expect(parse({nodes: [dataSource('a')], edges: [{source: 'a', target: 'missing'}]}).edges).toEqual([expect.objectContaining({target: 'missing'})]);
    });

    it('rejects a workflow without nodes, and text that is not JSON', () => {
        expect(errorOf(() => parse({edges: []}))).toBeInstanceOf(z.ZodError);
        expect(errorOf(() => parseWorkflowJson('{nodes'))).toBeInstanceOf(SyntaxError);
    });
});

describe('describeLoadError', () => {
    it('lists each zod problem with its path', () => {
        const error = errorOf(() => parse({nodes: [{id: '', type: 'data-source', position: {x: 0, y: 0}, data: {}}]}));

        expect(describeLoadError(error)).toBe('nodes→0→id: "id" must be a non-empty string');
    });

    it('gives a problem with no path as its message alone', () => {
        const error = errorOf(() => z.string().parse(1));

        expect(describeLoadError(error)).toBe('Expected string, received number');
    });

    it('gives any other error\'s message', () => {
        expect(describeLoadError(new Error('boom'))).toBe('boom');
    });
});
