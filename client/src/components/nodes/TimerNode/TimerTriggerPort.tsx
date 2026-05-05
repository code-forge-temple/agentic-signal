/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow} from "@xyflow/react";
import {NODE_PORT_COLORS, NODE_PORT_IDS} from "../../../constants";
import {NODE_TYPE} from "./constants";


export const TimerTriggerPort = () => {
    const {getNode} = useReactFlow();

    return (
        <Handle
            type="target"
            id={NODE_PORT_IDS.TRIGGER}
            position={Position.Bottom}
            style={{left: "auto", right: 13, backgroundColor: NODE_PORT_COLORS.TRIGGER}}
            isValidConnection={({source}) => {
                return getNode(source)?.type === NODE_TYPE;
            }}
        />
    );
};
