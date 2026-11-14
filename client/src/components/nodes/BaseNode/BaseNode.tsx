/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow, useStore} from "@xyflow/react";
import "./BaseNode.scss";
import React from "react";
import {NODE_PORT_IDS} from "../../../constants";
import {inputConnects, outputConnects, portColor, PortSetting} from "./connections";
import {NodeToolbar, OnClick} from "./NodeToolbar";
import {useAnimatedOutgoingEdges} from "./useAnimatedOutgoingEdges";


export type BaseNodeProps = {
    id: string;
    nodeIcon: React.ReactElement<{className?: string; color?: string}>;
    title: string;
    run?: OnClick;
    running?: boolean;
    stoppable?: boolean;
    ports: {
        input?: PortSetting;
        output?: PortSetting;
    };
    settings?: OnClick;
    logs?: OnClick;
    output?: OnClick;
    extraPorts?: React.ReactNode;
};


export const BaseNode = ({id, nodeIcon, title, running, ports, settings, run, stoppable, logs, output, extraPorts}: BaseNodeProps) => {
    const selected = useStore((state) => state.nodes.find((n) => n.id === id)?.selected ?? false);
    const {getEdges, getNode} = useReactFlow();
    const graph = {getEdges, getNode};

    useAnimatedOutgoingEdges(id, running);

    return (
        <div className="base-node">
            <div className="node-icon-wrapper">
                {React.cloneElement(nodeIcon, {
                    className: `${nodeIcon.props.className ?? ""} node-icon ${selected ? "selected" : ""}`.trim(),
                })}
                <div className="node-title-label">{title}</div>
            </div>
            <NodeToolbar settings={settings} logs={logs} output={output} run={run} running={running} stoppable={stoppable} />
            {ports.input ? (
                <Handle
                    type="target"
                    id={NODE_PORT_IDS.FLOW}
                    position={Position.Left}
                    style={{backgroundColor: portColor(ports.input)}}
                    isValidConnection={params => inputConnects(ports.input, id, params, graph)}
                />
            ) : null}
            {ports.output ? (
                <Handle
                    type="source"
                    id={NODE_PORT_IDS.FLOW}
                    position={Position.Right}
                    style={{backgroundColor: portColor(ports.output)}}
                    isValidConnection={params => outputConnects(ports.output, params, graph)}
                />
            ) : null}
            {extraPorts}
        </div>
    );
}
