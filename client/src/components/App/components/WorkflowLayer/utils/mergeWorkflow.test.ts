/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {Edge} from '@xyflow/react';
import {placeBelow} from './mergeWorkflow';
import {AppNode} from '../../../../nodes/workflow.gen';


const node = (id: string, x: number, y: number, height?: number) => ({
    id, type: 'data-source', position: {x, y}, data: {}, ...(height === undefined ? {} : {measured: {width: 10, height}}),
}) as unknown as AppNode;

describe('placeBelow', () => {
    it('moves the added nodes 100 below the lowest existing node, their left side on the existing left side', () => {
        const existing = [node('a', 50, 0, 60), node('b', 300, 200, 80)];
        const added = {nodes: [node('c', 1000, 500), node('d', 1200, 650)], edges: []};

        expect(placeBelow(existing, added).nodes.map(entry => entry.position)).toEqual([{x: 50, y: 380}, {x: 250, y: 530}]);
    });

    it('counts a node React Flow has not measured as 40 high', () => {
        const added = {nodes: [node('c', 0, 0)], edges: []};

        expect(placeBelow([node('a', 0, 10)], added).nodes[0].position).toEqual({x: 0, y: 150});
    });

    it('moves a wire\'s bend point with the nodes, and leaves a wire without one as it is', () => {
        const straight: Edge = {id: 's', source: 'c', target: 'd'};
        const bent: Edge = {id: 'b', source: 'c', target: 'd', data: {bend: {x: 5, y: 5}, other: 1}};
        const {edges} = placeBelow([node('a', 0, 0, 60)], {nodes: [node('c', 0, 0)], edges: [straight, bent]});

        expect(edges[0]).toBe(straight);
        expect(edges[1].data).toEqual({bend: {x: 5, y: 165}, other: 1});
    });

    it('leaves the added workflow where it is when either side has no nodes', () => {
        const added = {nodes: [node('c', 7, 9)], edges: []};
        const empty = {nodes: [], edges: [{id: 'e', source: 'x', target: 'y', data: {bend: {x: 1, y: 1}}}]};

        expect(placeBelow([], added)).toBe(added);
        expect(placeBelow([node('a', 0, 0, 60)], empty)).toBe(empty);
    });

    it('changes nothing in the workflows it is given', () => {
        const added = {nodes: [node('c', 1, 1)], edges: []};

        placeBelow([node('a', 0, 0, 60)], added);

        expect(added.nodes[0].position).toEqual({x: 1, y: 1});
    });
});
