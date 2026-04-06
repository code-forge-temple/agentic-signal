/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, IsValidConnection, Position, useReactFlow, useStore} from "@xyflow/react";
import "./BaseNode.scss";
import {AppWindow, Play, Settings, EyeSolid, PlaySolid} from "iconoir-react";
import React, {useEffect} from "react";
import {ThemeProvider, Tooltip} from "@mui/material";
import {darkTheme} from "../../../utils";
import {NODE_TYPE as ASYNC_DATA_AGGREGATOR_NODE_TYPE} from "../AsyncDataAggregatorNode/constants";


const DEFAULT_PORT_COLOR = "#ffc107";

const ISVALID_CONNECTION_FUNCTION_NAME = "isValidConnection";

const PORT_IDS = {
    input: "left-target",
    output: "right-source",
};

type OnClick = (() => void) | {callback: () => void; highlight: boolean};

type BaseNodeProps = {
    id: string;
    nodeIcon: React.ReactElement<{className?: string; color?: string}>;
    title: string;
    run?: OnClick;
    running?: boolean;
    stoppable?: boolean;
    ports: {
        input?: boolean | {isValidConnection?: IsValidConnection, color?: string};
        output?: boolean | {isValidConnection?: IsValidConnection, color?: string};
    };
    settings?: OnClick;
    logs?: OnClick;
    output?: OnClick;
    extraPorts?: React.ReactNode;
};

function buttonsPropsFactory (buttonProp: OnClick): React.SVGProps<SVGSVGElement>{
    return {
        width: 20,
        height: 20,
        onClick: "callback" in buttonProp ? buttonProp.callback : buttonProp,
        className: "highlight" in buttonProp && buttonProp.highlight ? "highlight" : "",
        pointerEvents: "all",
    }
}

export const BaseNode = ({id, nodeIcon, title, running, ports, settings, run, stoppable, logs, output, extraPorts}: BaseNodeProps) => {
    const selected = useStore((state) => state.nodes.find((n) => n.id === id)?.selected ?? false);
    const {setEdges, getEdges, getNode} = useReactFlow();

    useEffect(() => {
        const updateSourceEdges = (running: boolean) => {
            setEdges((edges) =>
                edges.map((edge) => {
                    if (edge.source === id) {
                        return {
                            ...edge,
                            animated: running,
                        };
                    }

                    return edge;
                })
            );
        };

        if (running !== undefined) {
            updateSourceEdges(running);
        }
    }, [id, running, setEdges]);

    const handleStyleInput = {
        backgroundColor: typeof ports.input === "object" && "color" in ports.input
            ? ports.input.color
            : DEFAULT_PORT_COLOR
    };

    const handleStyleOutput = {
        backgroundColor: typeof ports.output === "object" && "color" in ports.output
            ? ports.output.color
            : DEFAULT_PORT_COLOR
    };

    const inputIsValidConnection = (params: Parameters<IsValidConnection>[0]) => {
        if (typeof ports.input === "object" && ISVALID_CONNECTION_FUNCTION_NAME in ports.input && ports.input.isValidConnection) {
            return ports.input.isValidConnection(params);
        }

        if (params.sourceHandle !== PORT_IDS.output) return false;

        const node = getNode(id);

        if (node && node.type === ASYNC_DATA_AGGREGATOR_NODE_TYPE) return true;

        const edges = getEdges();
        const incoming = edges.filter(e => e.target === id && e.targetHandle === PORT_IDS.input);

        return incoming.length < 1;
    };

    const outputIsValidConnection = (params: Parameters<IsValidConnection>[0]) => {
        if (typeof ports.output === "object" && ISVALID_CONNECTION_FUNCTION_NAME in ports.output && ports.output.isValidConnection) {
            return ports.output.isValidConnection(params);
        }

        if (params.targetHandle !== PORT_IDS.input) return false;

        const targetNode = getNode(params.target);

        if (targetNode && targetNode.type === ASYNC_DATA_AGGREGATOR_NODE_TYPE) return true;

        if (!targetNode) return true;

        const edges = getEdges();
        const incoming = edges.filter(e => e.target === params.target && e.targetHandle === PORT_IDS.input);

        return incoming.length < 1;
    };

    return (
        <div className="base-node">
            <div className="node-icon-wrapper">
                {React.cloneElement(nodeIcon, {
                    className: `${nodeIcon.props.className ?? ""} node-icon ${selected ? "selected" : ""}`.trim(),
                })}
                <div className="node-title-label">{title}</div>
            </div>
            <ThemeProvider theme={darkTheme}>
                {settings ? (
                    <Tooltip title={"settings"} placement="bottom" arrow enterDelay={1000}>
                        <Settings {...buttonsPropsFactory(settings)} />
                    </Tooltip>
                ) : null}
                {logs ? (
                    <Tooltip title={"logs"} placement="bottom" arrow enterDelay={1000}>
                        <AppWindow {...buttonsPropsFactory(logs)} />
                    </Tooltip>
                ) : null}
                {output ? (
                    <Tooltip title={"output"} placement="bottom" arrow enterDelay={1000}>
                        <EyeSolid {...buttonsPropsFactory(output)} />
                    </Tooltip>
                ) : null}
                {run && running && !stoppable ? <PlaySolid width={20} height={20} className="highlight" /> : null}
                {run && running && stoppable ? <PlaySolid {...buttonsPropsFactory(run)} className="highlight" /> : null}
                {run && !running ? (
                    <Tooltip title={"run"} placement="bottom" arrow enterDelay={1000}>
                        <Play {...buttonsPropsFactory(run)} />
                    </Tooltip>
                ) : null}
            </ThemeProvider>
            {ports.input ? (
                <Handle
                    type="target"
                    id={PORT_IDS.input}
                    position={Position.Left}
                    style={handleStyleInput}
                    isValidConnection={inputIsValidConnection}
                />
            ) : null}
            {ports.output ? (
                <Handle
                    type="source"
                    id={PORT_IDS.output}
                    position={Position.Right}
                    style={handleStyleOutput}
                    isValidConnection={outputIsValidConnection}
                />
            ) : null}
            {extraPorts}
        </div>
    );
}