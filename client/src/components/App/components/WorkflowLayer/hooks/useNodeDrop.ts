/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback} from 'react';
import {useReactFlow} from '@xyflow/react';
import {v4 as uuidv4} from 'uuid';
import {nodeFactory} from '../../../../nodes';
import {AppNode, AppNodeType} from '../../../../nodes/workflow.gen';


// How far up and left of the pointer a dropped node lands, in screen pixels at zoom 1.
const DROP_OFFSET_PX = 20;

/** Drag-and-drop of a node from the dock onto the canvas; a read-only layer takes none. */
export function useNodeDrop (addNode: (node: AppNode) => void, readOnly: boolean) {
    const reactFlowInstance = useReactFlow();

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = readOnly ? 'none' : 'move';
    }, [readOnly]);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();

        if (readOnly) return;

        const nodeType = event.dataTransfer.getData('application/reactflow') as AppNodeType;

        if (!nodeType) return;

        const zoom = reactFlowInstance.getZoom?.() ?? 1;
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX - DROP_OFFSET_PX * zoom,
            y: event.clientY - DROP_OFFSET_PX * zoom,
        });

        addNode(nodeFactory(nodeType, uuidv4(), position));
    }, [addNode, reactFlowInstance, readOnly]);

    return {onDragOver, onDrop};
}
