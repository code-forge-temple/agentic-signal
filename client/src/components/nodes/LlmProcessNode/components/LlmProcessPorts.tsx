/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow} from "@xyflow/react";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../../constants";
import {NODE_TYPE as TOOL_NODE_TYPE} from "../../ToolNode/constants";
import {NODE_TYPE as RAG_NODE_TYPE} from "../../RagNode/constants";
import {TimerTriggerPort} from "../../TimerNode/TimerTriggerPort";


/** The LLM node's extra ports: AI Tool nodes, one RAG node at most, and a Timer. */
export function LlmProcessPorts ({id}: {id: string}) {
    const {getNode, getEdges} = useReactFlow();
    const hasContext = () => getEdges().some(edge => edge.target === id && edge.targetHandle === NODE_PORT_IDS.CONTEXT);

    return (
        <>
            <Handle
                type="target"
                id={NODE_PORT_IDS.TOOL}
                position={Position.Bottom}
                style={{left: 30, backgroundColor: NODE_PORT_COLORS.TOOL}}
                isValidConnection={({source}) => getNode(source)?.type === TOOL_NODE_TYPE}
            />
            <Handle
                type="target"
                id={NODE_PORT_IDS.CONTEXT}
                position={Position.Bottom}
                style={{left: 10, backgroundColor: NODE_PORT_COLORS.CONTEXT}}
                isValidConnection={({source}) => getNode(source)?.type === RAG_NODE_TYPE && !hasContext()}
            />
            <TimerTriggerPort />
        </>
    );
}
