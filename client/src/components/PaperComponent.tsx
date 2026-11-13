/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Paper, {PaperProps} from "@mui/material/Paper";
import {useRef} from "react";
import Draggable from "react-draggable";


export interface PaperComponentProps extends PaperProps {
    enableDragging?: boolean;
    cancel?: string;
}

export function PaperComponent (props: PaperComponentProps) {
    const {enableDragging = true, cancel, ...paperProps} = props;
    const nodeRef = useRef<HTMLDivElement>(null);

    // Always wrapped, only switched off: swapping the wrapper in and out (maximize, restore) would
    // remount the dialog's whole content and lose its state, like the open tab. Pinned at the origin
    // while off, so a maximized dialog isn't left offset by an earlier drag.
    return (
        <Draggable
            nodeRef={nodeRef as React.RefObject<HTMLDivElement>}
            cancel={cancel}
            disabled={!enableDragging}
            position={enableDragging ? undefined : {x: 0, y: 0}}
        >
            <Paper {...paperProps} ref={nodeRef} />
        </Draggable>
    );
}