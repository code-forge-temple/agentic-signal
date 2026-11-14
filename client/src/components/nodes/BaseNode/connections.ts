/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Edge, IsValidConnection, Node} from "@xyflow/react";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../constants";
import {NODE_TYPE as ASYNC_DATA_AGGREGATOR_NODE_TYPE} from "../AsyncDataAggregatorNode/constants";

/** A node's flow port: on (true), off, or on with its own color and connection check. */
export type PortSetting = boolean | {isValidConnection?: IsValidConnection; color?: string} | undefined;

type ConnectionParams = Parameters<IsValidConnection>[0];

/** What a connection check reads of the flow. */
export type FlowGraph = {getNode: (id: string) => Node | undefined; getEdges: () => Edge[]};

/** The port's color: its own, else the flow color. */
export const portColor = (port: PortSetting): string | undefined =>
    (typeof port === "object" && "color" in port ? port.color : NODE_PORT_COLORS.FLOW);

const hasOwnCheck = (port: PortSetting): port is {isValidConnection: IsValidConnection} =>
    typeof port === "object" && "isValidConnection" in port && !!port.isValidConnection;

/** Flow port to flow port, between two different nodes. */
const isFlowEdge = (params: ConnectionParams): boolean =>
    params.sourceHandle === NODE_PORT_IDS.FLOW && params.targetHandle === NODE_PORT_IDS.FLOW && params.source !== params.target;

/** Whether the node takes one more flow input: an aggregator takes any number, any other node just one. */
function takesFlowInput (node: Node | undefined, nodeId: string, getEdges: FlowGraph["getEdges"]): boolean {
    if (node?.type === ASYNC_DATA_AGGREGATOR_NODE_TYPE) return true;

    return !getEdges().some(edge => edge.target === nodeId && edge.targetHandle === NODE_PORT_IDS.FLOW);
}

/** Whether a connection may end on this node's input: by the port's own check, else a flow edge to a node that takes it. */
export function inputConnects (port: PortSetting, nodeId: string, params: ConnectionParams, {getNode, getEdges}: FlowGraph): boolean {
    if (hasOwnCheck(port)) return port.isValidConnection(params);

    return isFlowEdge(params) && takesFlowInput(getNode(nodeId), nodeId, getEdges);
}

/**
 * Whether a connection may start at this node's output: by the port's own check, else a flow edge to a node that takes
 * it (or one the flow doesn't have yet). Checked on every pointer move while dragging: the target is looked up once.
 */
export function outputConnects (port: PortSetting, params: ConnectionParams, {getNode, getEdges}: FlowGraph): boolean {
    if (hasOwnCheck(port)) return port.isValidConnection(params);

    if (!isFlowEdge(params)) return false;

    const target = getNode(params.target);

    return !target || takesFlowInput(target, params.target, getEdges);
}
