/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Edge, Node} from "@xyflow/react";
import {NODE_PORT_IDS} from "../../../../constants";
import {NODE_TYPE as TOOL_NODE_TYPE} from "../../ToolNode/constants";
import {NODE_TYPE as RAG_NODE_TYPE} from "../../RagNode/constants";
import {assertIsToolNodeData, ToolNode} from "../../ToolNode/types/workflow";
import {assertIsRagNodeData, RagNode} from "../../RagNode/types/workflow";
import {SessionId} from "../../ToolNode/tools/types";
import {SystemUserConfigValues, ToolSchema} from "../../../../types/tool.types";
import {NodeEnvelope} from "../../../../types/workflow";
import {AIRequest} from "./aiRequest";


const sourcesOf = (id: string, port: string, nodes: Node[], edges: Edge[]) => edges
    .filter(edge => edge.target === id && edge.targetHandle === port)
    .map(edge => nodes.find(node => node.id === edge.source));

/** The AI Tool nodes plugged into the LLM node's tool port. */
export function connectedToolNodes (id: string, nodes: Node[], edges: Edge[]): ToolNode[] {
    return sourcesOf(id, NODE_PORT_IDS.TOOL, nodes, edges)
        .filter((node): node is ToolNode => !!node && node.type === TOOL_NODE_TYPE)
        .map((node) => {
            assertIsToolNodeData(node.data);

            return node;
        });
}

const isRagNode = (node: Node | undefined): node is RagNode => {
    if (!node || node.type !== RAG_NODE_TYPE) return false;

    try {
        assertIsRagNodeData(node.data);

        return true;
    } catch {
        return false;
    }
};

/** The handler of the RAG node plugged into the LLM node's context port, if there is one. */
export function connectedRagHandler (id: string, nodes: Node[], edges: Edge[]) {
    const handler = sourcesOf(id, NODE_PORT_IDS.CONTEXT, nodes, edges).find(isRagNode)?.data.handler;

    return typeof handler === "function" ? handler : undefined;
}

/** The request's tools: each tool node's handler, called with the input's attachments and the run's session. */
export function requestTools (toolNodes: ToolNode[], toolsPayload: NodeEnvelope['toolsPayload'], sessionId: SessionId): NonNullable<AIRequest['tools']> {
    return toolNodes
        .filter(node => typeof node.data.handler === "function")
        .map(node => ({
            schema: node.data.toolSchema as ToolSchema,
            handler: async (params: any) => (node.data.handler as (params: any) => Promise<any>)({...params, toolsPayload, sessionId}),
            systemUserConfigValues: node.data.userConfig as SystemUserConfigValues || {},
        }));
}

/**
 * Lets each tool release what it opened for the run's session (a browser session, say), once the run has ended and
 * the output is updated. The LLM node needs to know nothing tool-specific for that.
 */
export function cleanupTools (toolNodes: ToolNode[], sessionId: SessionId) {
    return Promise.all(toolNodes
        .filter(node => typeof node.data.cleanup === "function")
        .map(node => (node.data.cleanup as (sessionId: SessionId) => Promise<void>)(sessionId)));
}
