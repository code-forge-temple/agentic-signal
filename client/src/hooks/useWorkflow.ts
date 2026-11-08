/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useMemo, useRef} from 'react';
import {
    addEdge,
    useNodesState,
    useEdgesState,
    type OnConnect,
    type Connection,
    Edge,
    OnEdgesDelete,
    OnNodesDelete,
} from '@xyflow/react';
import {initialEdges, initialNodes} from '../components/nodes';
import {nodeRegistry} from '../components/nodes/nodeRegistry.gen';
import {AppNode} from '../components/nodes/workflow.gen';
import {NodeEnvelope} from '../types/workflow';
import {Feed, NodeAssertions, workflowNodes} from '../utils/workflowNodes';


const updates = workflowNodes(Object.fromEntries(nodeRegistry.map(descriptor => [descriptor.type, descriptor.assertion])) as NodeAssertions);

type NodeHandlers = {
    onConfigChange: (nodeId: string, data: Record<string, any>) => void;
    onResultUpdate: (nodeId: string, input?: NodeEnvelope) => void;
    onFeedbackSend: (fromNodeId: string, feedback: string) => void;
};

// Each node with the handlers merged into its data. A node that didn't change keeps its enhanced copy, so React Flow
// doesn't redraw it.
function useEnhancedNodes (nodes: AppNode[], {onConfigChange, onResultUpdate, onFeedbackSend}: NodeHandlers): AppNode[] {
    const cacheRef = useRef<Map<AppNode, AppNode>>(new Map());

    return useMemo(() => {
        const previous = cacheRef.current;
        const next = new Map<AppNode, AppNode>();
        const enhanced = nodes.map((node) => {
            const copy = previous.get(node) ?? updates.update(node, {onConfigChange, onResultUpdate, onFeedbackSend});

            next.set(node, copy);

            return copy;
        });

        cacheRef.current = next;

        return enhanced;
    }, [nodes, onConfigChange, onResultUpdate, onFeedbackSend]);
}

export function useWorkflow () {
    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
    const feedsRef = useRef<Feed[]>([]);

    useEffect(() => {
        feedsRef.current = edges.map(({source, target}) => ({source, target}));
    }, [edges]);

    const onConnect: OnConnect = useCallback((connection: Connection) => setEdges(current => addEdge(connection, current)), [setEdges]);

    // A deleted edge takes back what came through it.
    const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => setNodes(current => updates.cut(current, deleted)), [setNodes]);

    // A deleted node takes back what it sent.
    const onNodesDelete: OnNodesDelete = useCallback((deleted) => {
        const ids = new Set(deleted.map(node => node.id));
        const cut = feedsRef.current.filter(feed => ids.has(feed.source));

        setNodes(current => updates.cut(current, cut));
    }, [setNodes]);

    const onConfigChange = useCallback((nodeId: string, data: Record<string, any>) => {
        setNodes(current => updates.configure(current, nodeId, data));
    }, [setNodes]);

    const onResultUpdate = useCallback((nodeId: string, input?: NodeEnvelope) => {
        setNodes(current => updates.deliver(current, feedsRef.current, nodeId, input));
    }, [setNodes]);

    const onFeedbackSend = useCallback((fromNodeId: string, feedback: string) => {
        setNodes(current => updates.sendFeedback(current, feedsRef.current, fromNodeId, feedback));
    }, [setNodes]);

    const addNode = useCallback((node: AppNode) => setNodes(current => [...current, node]), [setNodes]);

    return {
        nodes: useEnhancedNodes(nodes, {onConfigChange, onResultUpdate, onFeedbackSend}),
        edges,
        onNodesChange,
        onEdgesChange,
        onEdgesDelete,
        onNodesDelete,
        onConnect,
        addNode,
        setNodes,
        setEdges,
    };
}
