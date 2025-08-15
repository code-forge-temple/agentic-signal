/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, IsValidConnection, Position, useReactFlow} from "@xyflow/react";
import "./BaseNode.scss";
import {AppWindow, Play, Settings, EyeSolid, PlaySolid} from "iconoir-react";
import React, {useEffect} from "react";
import {ThemeProvider, Tooltip} from "@mui/material";
import {darkTheme} from "../../../utils";

const DEFAULT_PORT_COLOR = "#ffc107";

const PORT_IDS = {
    input: "left-target",
    output: "right-source"
};

type OnClick = (() => void) | {callback: () => void; highlight: boolean};

type BaseNodeProps = {
    id: string;
    nodeIcon: React.ReactElement<{className?: string}>;
    title: string;
    running?: boolean;
    ports: {
        input?: boolean | {isValidConnection?: IsValidConnection, color?: string};
        output?: boolean | {isValidConnection?: IsValidConnection, color?: string};
    };
    settings?: OnClick;
    run?: OnClick;
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
        pointerEvents: "bounding-box",
    }
}

export const BaseNode = ({id, nodeIcon, title, running, ports, settings, run, logs, output, extraPorts}: BaseNodeProps) => {
    const {setEdges} = useReactFlow();

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

    return (
        <div className="base-node">
            <div className="node-icon-wrapper">
                {React.cloneElement(nodeIcon, {
                    className: `${nodeIcon.props.className ?? ""} node-icon`.trim()
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
                {run && running ? <PlaySolid width={20} height={20} className="highlight" /> : null}
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
                    isValidConnection={
                        typeof ports.input === "object" && "isValidConnection" in ports.input
                            ? ports.input.isValidConnection
                            : ({sourceHandle}) => sourceHandle === PORT_IDS.output} />
            ) : null}
            {ports.output ? (
                <Handle
                    type="source"
                    id={PORT_IDS.output}
                    position={Position.Right}
                    style={handleStyleOutput}
                    isValidConnection={
                        typeof ports.output === "object" && "isValidConnection" in ports.output
                            ? ports.output.isValidConnection
                            : ({targetHandle}) => targetHandle === PORT_IDS.input
                    }
                />
            ) : null}
            {extraPorts}
        </div>
    );
}