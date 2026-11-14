/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from "react";
import {AppWindow, Play, Settings, EyeSolid, PlaySolid} from "iconoir-react";
import {ThemeProvider} from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import {darkTheme} from "../../../utils";

type ClickCallback = () => void | Promise<void>;

/** A toolbar button's action, highlighted when it needs looking at. */
export type OnClick = ClickCallback | {callback: ClickCallback; highlight: boolean};

function buttonsPropsFactory (buttonProp: OnClick): React.SVGProps<SVGSVGElement>{
    const callback = "callback" in buttonProp ? buttonProp.callback : buttonProp;

    return {
        width: 20,
        height: 20,
        onClick: () => { void callback(); },
        className: "highlight" in buttonProp && buttonProp.highlight ? "highlight" : "",
        pointerEvents: "all",
    }
}

type NodeToolbarProps = {
    settings?: OnClick;
    logs?: OnClick;
    output?: OnClick;
    run?: OnClick;
    running?: boolean;
    stoppable?: boolean;
};

/** A labelled toolbar button, shown when the node has that action. */
function ToolbarButton ({label, action, Icon}: {label: string; action?: OnClick; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>}) {
    if (!action) return null;

    return (
        <Tooltip title={label} placement="bottom" arrow enterDelay={1000}>
            <Icon {...buttonsPropsFactory(action)} />
        </Tooltip>
    );
}

/** The run button: Run, or while running a highlighted icon that stops the node when it can be stopped. */
function RunButton ({run, running, stoppable}: Pick<NodeToolbarProps, "run" | "running" | "stoppable">) {
    if (!run) return null;

    if (!running) return <ToolbarButton label="run" action={run} Icon={Play} />;

    return stoppable ? <PlaySolid {...buttonsPropsFactory(run)} className="highlight" /> : <PlaySolid width={20} height={20} className="highlight" />;
}

/** The node's buttons: settings, logs, output and run, each when the node has it. */
export function NodeToolbar ({settings, logs, output, run, running, stoppable}: NodeToolbarProps) {
    return (
        <ThemeProvider theme={darkTheme}>
            <ToolbarButton label="settings" action={settings} Icon={Settings} />
            <ToolbarButton label="logs" action={logs} Icon={AppWindow} />
            <ToolbarButton label="output" action={output} Icon={EyeSolid} />
            <RunButton run={run} running={running} stoppable={stoppable} />
        </ThemeProvider>
    );
}
