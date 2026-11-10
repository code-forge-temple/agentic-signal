/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow} from "@xyflow/react";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../../constants";
import {NODE_TYPE as LLM_NODE_TYPE} from "../../LlmProcessNode/constants";


/** The RAG node's context port: it connects to an LLM node's context port, if nothing is connected there yet. */
export function RagPort () {
    const {getNode, getEdges} = useReactFlow();

    return (
        <Handle
            type="source"
            id={NODE_PORT_IDS.CONTEXT}
            position={Position.Right}
            style={{backgroundColor: NODE_PORT_COLORS.CONTEXT}}
            isValidConnection={({target, targetHandle}) => {
                if (getNode(target)?.type !== LLM_NODE_TYPE || targetHandle !== NODE_PORT_IDS.CONTEXT) return false;

                return !getEdges().some(edge => edge.target === target && edge.targetHandle === NODE_PORT_IDS.CONTEXT);
            }}
        />
    );
}
