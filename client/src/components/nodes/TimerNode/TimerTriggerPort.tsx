/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow} from "@xyflow/react";
import {TaskNodeType, TIMER_TRIGGER_PORT_COLOR, TIMER_TRIGGER_PORT_ID} from "../../../constants";


export const TimerTriggerPort = () => {
    const {getNode} = useReactFlow();

    return (
        <Handle
            type="target"
            id={TIMER_TRIGGER_PORT_ID}
            position={Position.Bottom}
            style={{left: "auto", right: 13, backgroundColor: TIMER_TRIGGER_PORT_COLOR}}
            isValidConnection={({source}) => {
                return getNode(source)?.type === TaskNodeType.TIMER;
            }}
        />
    );
};
