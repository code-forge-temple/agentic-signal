/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {useReactFlow} from "@xyflow/react";

/** Animates the node's outgoing edges while it runs; a node that doesn't say whether it runs leaves them as they are. */
export function useAnimatedOutgoingEdges (id: string, running: boolean | undefined) {
    const {setEdges} = useReactFlow();

    useEffect(() => {
        if (running === undefined) return;

        setEdges(edges => edges.map(edge => (edge.source === id ? {...edge, animated: running} : edge)));
    }, [id, running, setEdges]);
}
