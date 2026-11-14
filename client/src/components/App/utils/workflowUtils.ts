/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NODE_PORT_IDS} from '../../../constants';
import {NODE_TYPE as TOOL_NODE_TYPE} from '../../nodes/ToolNode/constants';
import {NODE_TYPE as ASYNC_DATA_AGGREGATOR_NODE_TYPE} from '../../nodes/AsyncDataAggregatorNode/constants';
import {NODE_TYPE as RAG_NODE_TYPE} from '../../nodes/RagNode/constants';
import {NODE_TYPE as TIMER_NODE_TYPE} from '../../nodes/TimerNode/constants';
import {NODE_TYPE as LLM_NODE_TYPE} from '../../nodes/LlmProcessNode/constants';

export function getExpectedEdgeHandle (sourceType: string, targetType: string) {
    if (sourceType === TIMER_NODE_TYPE || targetType === TIMER_NODE_TYPE) {
        return NODE_PORT_IDS.TRIGGER;
    }

    if (sourceType === TOOL_NODE_TYPE || targetType === TOOL_NODE_TYPE) {
        return NODE_PORT_IDS.TOOL;
    }

    if (sourceType === RAG_NODE_TYPE || targetType === RAG_NODE_TYPE) {
        return NODE_PORT_IDS.CONTEXT;
    }

    return NODE_PORT_IDS.FLOW;
}

type ImportedEdge = { id?: unknown; source: string; target: string; sourceHandle?: unknown; targetHandle?: unknown };

// Nodes that may only be connected to an LLM process node, checked in this order.
const LLM_ONLY_NODES = [[RAG_NODE_TYPE, "a RAG node"], [TOOL_NODE_TYPE, "a tool node"]] as const;

/** Throws when an edge connects a RAG or tool node to anything but an LLM process node. */
function assertLlmOnlyEdge (sourceType: string, targetType: string): void {
    const touchesLlm = sourceType === LLM_NODE_TYPE || targetType === LLM_NODE_TYPE;

    for (const [type, name] of LLM_ONLY_NODES) {
        if ((sourceType === type || targetType === type) && !touchesLlm) {
            throw new Error(`Invalid workflow import: edges involving ${name} must connect only to an LLM process node.`);
        }
    }
}

/** Throws when the edge isn't on the port its two nodes call for; returns that port. */
function assertEdgeHandle (edge: ImportedEdge, sourceType: string, targetType: string): string {
    const expectedHandle = getExpectedEdgeHandle(sourceType, targetType);
    const sourceHandle = edge.sourceHandle ?? NODE_PORT_IDS.FLOW;
    const targetHandle = edge.targetHandle ?? NODE_PORT_IDS.FLOW;

    if (sourceHandle !== expectedHandle || targetHandle !== expectedHandle) {
        throw new Error(
            `Invalid workflow import: edge "${edge.id ?? `${edge.source}-${edge.target}`}" ` +
            `between "${sourceType}" and "${targetType}" must use handle "${expectedHandle}".`
        );
    }

    return expectedHandle;
}

export function assertValidWorkflowEdges (nodes: { id: string; type: string }[], edges: ImportedEdge[]) {
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const flowTargetCounts = new Map<string, number>();

    for (const edge of edges) {
        const sourceNode = nodeById.get(edge.source);
        const targetNode = nodeById.get(edge.target);

        if (!sourceNode || !targetNode) {
            continue;
        }

        assertLlmOnlyEdge(sourceNode.type, targetNode.type);

        const expectedHandle = assertEdgeHandle(edge, sourceNode.type, targetNode.type);

        // Only flow inputs are counted, and an aggregator takes any number.
        if (expectedHandle !== NODE_PORT_IDS.FLOW || targetNode.type === ASYNC_DATA_AGGREGATOR_NODE_TYPE) {
            continue;
        }

        const count = (flowTargetCounts.get(edge.target) ?? 0) + 1;

        if (count > 1) {
            throw new Error(
                `Invalid workflow import: node "${edge.target}" has multiple incoming "${NODE_PORT_IDS.FLOW}" edges. ` +
                `Only async data aggregator nodes may receive multiple "${NODE_PORT_IDS.FLOW}" inputs.`
            );
        }

        flowTargetCounts.set(edge.target, count);
    }
}
