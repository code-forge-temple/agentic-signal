/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Paper, PaperProps} from "@mui/material";
import {useRef} from "react";
import Draggable from "react-draggable";


export interface PaperComponentProps extends PaperProps {
    enableDragging?: boolean;
    cancel?: string;
}

export function PaperComponent (props: PaperComponentProps) {
    const {enableDragging = true, cancel, ...paperProps} = props;
    const nodeRef = useRef<HTMLDivElement>(null);

    if (!enableDragging) {
        return <Paper {...paperProps} ref={nodeRef} />;
    }

    return (
        <Draggable
            nodeRef={nodeRef as React.RefObject<HTMLDivElement>}
            cancel={cancel}
        >
            <Paper {...paperProps} ref={nodeRef} />
        </Draggable>
    );
}