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

export function assertValidWorkflowEdges (nodes: any[], edges: any[]) {
    const nodeById = new Map(nodes.map((node: any) => [node.id, node]));
    const flowTargetCounts = new Map<string, number>();

    for (const edge of edges) {
        const sourceNode = nodeById.get(edge.source);
        const targetNode = nodeById.get(edge.target);

        if (!sourceNode || !targetNode) {
            continue;
        }

        if (sourceNode.type === RAG_NODE_TYPE || targetNode.type === RAG_NODE_TYPE) {
            if (sourceNode.type !== LLM_NODE_TYPE && targetNode.type !== LLM_NODE_TYPE) {
                throw new Error(
                    `Invalid workflow import: edges involving a RAG node must connect only to an LLM process node.`
                );
            }
        }

        if (sourceNode.type === TOOL_NODE_TYPE || targetNode.type === TOOL_NODE_TYPE) {
            if (sourceNode.type !== LLM_NODE_TYPE && targetNode.type !== LLM_NODE_TYPE) {
                throw new Error(
                    `Invalid workflow import: edges involving a tool node must connect only to an LLM process node.`
                );
            }
        }

        const expectedHandle = getExpectedEdgeHandle(sourceNode.type, targetNode.type);
        const sourceHandle = edge.sourceHandle ?? NODE_PORT_IDS.FLOW;
        const targetHandle = edge.targetHandle ?? NODE_PORT_IDS.FLOW;

        if (sourceHandle !== expectedHandle || targetHandle !== expectedHandle) {
            throw new Error(
                `Invalid workflow import: edge "${edge.id ?? `${edge.source}-${edge.target}`}" ` +
                `between "${sourceNode.type}" and "${targetNode.type}" must use handle "${expectedHandle}".`
            );
        }

        if (expectedHandle !== NODE_PORT_IDS.FLOW) {
            continue;
        }

        if (targetNode.type === ASYNC_DATA_AGGREGATOR_NODE_TYPE) {
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
