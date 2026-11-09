/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {workflowFileName, workflowToJson} from './workflowFile';
import {AppNode} from '../../../../nodes/workflow.gen';


const node = (data: Record<string, unknown>) => ({id: 'n', type: 'data-source', position: {x: 1, y: 2}, data}) as unknown as AppNode;

describe('workflowToJson', () => {
    it('leaves out the paths a node marks to sanitize, nested ones too, and the list itself', () => {
        const data = {title: 'T', token: 'secret', config: {key: 'k', keep: 1}, toSanitize: ['token', 'config.key']};
        const json = JSON.parse(workflowToJson([node(data)], [])) as {nodes: {data: unknown}[]};

        expect(json.nodes[0].data).toEqual({title: 'T', config: {keep: 1}});
    });

    it('skips a path that leads nowhere, and changes nothing in the workflow itself', () => {
        const data = {title: 'T', toSanitize: ['missing.deep.key', 'title.sub']};
        const json = JSON.parse(workflowToJson([node(data)], [])) as {nodes: {data: unknown}[]};

        expect(json.nodes[0].data).toEqual({title: 'T'});
        expect(data.toSanitize).toEqual(['missing.deep.key', 'title.sub']);
    });

    it('keeps the node\'s other fields and the edges, indented by four spaces', () => {
        const edges = [{id: 'e', source: 'n', target: 'm'}];
        const text = workflowToJson([node({title: 'T'})], edges);

        expect(JSON.parse(text)).toEqual({nodes: [{id: 'n', type: 'data-source', position: {x: 1, y: 2}, data: {title: 'T'}}], edges});
        expect(text).toContain('\n    "nodes"');
    });
});

describe('workflowFileName', () => {
    it('turns the characters a file system refuses into "_"', () => {
        expect(workflowFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j.json');
        expect(workflowFileName('weather')).toBe('weather.json');
    });
});
