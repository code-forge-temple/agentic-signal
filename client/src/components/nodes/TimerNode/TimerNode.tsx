/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import {Handle, Position, type NodeProps} from "@xyflow/react";
import {MonitoredNode} from "../MonitoredNode";
import {assertIsTimerNodeData, TimerNodeData} from "./types/workflow";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../constants";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {useTimerRun} from "./hooks/useTimerRun";
import {TimerSettings} from "./components/TimerSettings";


export function TimerNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsTimerNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const {title, onResultUpdate, onConfigChange} = data;
    const {isRunning, toggle, error} = useTimerRun({id, data, onResultUpdate});

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                title={title}
                ports={{}}
                run={toggle}
                running={isRunning}
                stoppable={true}
                settings={{callback: () => setOpenSettings(true), highlight: false}}
                error={error}
                extraPorts={
                    <Handle
                        type="source"
                        id={NODE_PORT_IDS.TRIGGER}
                        position={Position.Right}
                        style={{background: NODE_PORT_COLORS.TRIGGER}}
                        isValidConnection={({targetHandle}) => targetHandle === NODE_PORT_IDS.TRIGGER}
                    />
                }
            />
            <TimerSettings
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
                data={data}
                change={(changes: Partial<TimerNodeData>) => onConfigChange(id, changes)}
            />
        </>
    );
}
