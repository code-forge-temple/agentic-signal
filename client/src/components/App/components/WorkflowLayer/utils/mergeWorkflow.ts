/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Edge} from '@xyflow/react';
import {AppNode} from '../../../../nodes/workflow.gen';
import {ElbowEdgeData} from '../../../../edges/ElbowEdge/ElbowEdge';
import {Workflow} from '../types';


// Room left between the workflow and the one added under it.
const MERGE_GAP = 100;

// The height counted for a node React Flow hasn't measured yet.
const UNMEASURED_NODE_HEIGHT = 40;

const moved = (node: AppNode, dx: number, dy: number): AppNode => ({...node, position: {x: node.position.x + dx, y: node.position.y + dy}});

// A wire's bend point moves with its nodes; a wire without one routes itself.
function withBendMoved (edge: Edge, dx: number, dy: number): Edge {
    const bend = (edge.data as ElbowEdgeData | undefined)?.bend;

    if (!bend) return edge;

    return {...edge, data: {...edge.data, bend: {x: bend.x + dx, y: bend.y + dy}}};
}

/**
 * The added workflow moved under the existing one, its left side lined up with the existing one's. With nothing on
 * either side there is nothing to line up, and the added workflow stays where it is.
 */
export function placeBelow (existing: AppNode[], added: Workflow): Workflow {
    if (existing.length === 0 || added.nodes.length === 0) return added;

    const bottom = Math.max(...existing.map(node => node.position.y + (node.measured?.height ?? UNMEASURED_NODE_HEIGHT)));
    const left = Math.min(...existing.map(node => node.position.x));
    const dx = left - Math.min(...added.nodes.map(node => node.position.x));
    const dy = bottom + MERGE_GAP - Math.min(...added.nodes.map(node => node.position.y));

    return {
        nodes: added.nodes.map(node => moved(node, dx, dy)),
        edges: added.edges.map(edge => withBendMoved(edge, dx, dy)),
    };
}
