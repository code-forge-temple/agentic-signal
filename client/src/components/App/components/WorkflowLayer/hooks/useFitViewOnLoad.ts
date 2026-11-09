/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {RefObject, useCallback, useEffect, useRef} from 'react';
import {FitViewOptions, useNodesInitialized, useReactFlow} from '@xyflow/react';
import {AppNode} from '../../../../nodes/workflow.gen';


const FIT_VIEW_TOP_BUFFER_PX = 16;

/**
 * Fits the view to a workflow once its nodes are drawn, after `fitViewOnLoad()` marked the load. `fitViewPadding()`
 * keeps the nodes clear of the dock.
 */
export function useFitViewOnLoad (dockRef: RefObject<HTMLDivElement | null>, nodes: AppNode[]) {
    const reactFlowInstance = useReactFlow();
    const nodesInitialized = useNodesInitialized();
    const fitViewOnLoadRef = useRef(false);

    // Measured rather than hardcoded: the dock's height isn't fixed (it can wrap/resize with its
    // content), so a constant would drift out of sync and let nodes end up hidden behind it again.
    const fitViewPadding = useCallback((): FitViewOptions['padding'] => {
        const dockHeight = dockRef.current?.getBoundingClientRect().height ?? 0;

        return {top: `${dockHeight + FIT_VIEW_TOP_BUFFER_PX}px`, x: '20%', bottom: '20%'};
    }, [dockRef]);

    useEffect(() => {
        if (nodesInitialized && fitViewOnLoadRef.current) {
            fitViewOnLoadRef.current = false;
            void reactFlowInstance.fitView({padding: fitViewPadding(), duration: 400});
        }
        // `nodes` is intentionally included: replacing an existing workflow keeps
        // nodesInitialized `true` throughout (no false->true edge to react to), so
        // this effect must also re-run whenever the node set itself changes.
    }, [nodesInitialized, nodes, reactFlowInstance, fitViewPadding]);

    const fitViewOnLoad = useCallback(() => {
        fitViewOnLoadRef.current = true;
    }, []);

    return {fitViewPadding, fitViewOnLoad};
}
