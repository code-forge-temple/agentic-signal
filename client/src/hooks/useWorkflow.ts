/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef, useState} from 'react';
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
import {AppNode, AppNodeType} from '../components/nodes/workflow.gen';
import {NODE_TYPE as LLM_NODE_TYPE} from '../components/nodes/LlmProcessNode/constants';


const nodeAssertions = Object.fromEntries(
    nodeRegistry.map(nodeDescriptor => [nodeDescriptor.type, nodeDescriptor.assertion])
) as Record<AppNodeType, (data: unknown) => void>;

function updateNodeData<T extends AppNode> (
    node: T,
    newData: Partial<T['data']>,
    assertions: Record<AppNodeType, (data: unknown) => void>
): T {
    // Merge newData over node.data, but never remove required fields
    const updatedData = {...node.data, ...newData};
    const assert = assertions[node.type];

    if (assert) assert(updatedData);

    return {...node, data: updatedData};
}

export function useWorkflow () {
    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
    const [results, setResults] = useState<Map<string, any>>(new Map());
    const edgeConnectionsRef = useRef<Pick<Edge, 'source' | 'target'>[]>([]);

    useEffect(() => {
        edgeConnectionsRef.current = edges.map(({source, target}) => ({source, target}));
    }, [edges]);

    // Handle node connections
    const onConnect: OnConnect = useCallback(
        (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
        [setEdges]
    );

    const onEdgesDelete: OnEdgesDelete = useCallback(
        (deletedEdges) => {
            // When edges are deleted, clear inputs for affected target nodes
            deletedEdges.forEach((edge) => {
                setNodes((nds) =>
                    nds.map((node) => {
                        if (node.id === edge.target) {
                            return updateNodeData(node, {input: undefined}, nodeAssertions);
                        }

                        return node;
                    })
                );

                // Also clear the result for the target node
                setResults((prev) => {
                    const newResults = new Map(prev);

                    newResults.delete(edge.target);

                    return newResults;
                });
            });
        },
        [setNodes]
    );

    const onNodesDelete: OnNodesDelete = useCallback(
        (deletedNodes) => {
            deletedNodes.forEach((deletedNode) => {
                // Clear the result for the deleted node
                setResults((prev) => {
                    const newResults = new Map(prev);

                    newResults.delete(deletedNode.id);

                    return newResults;
                });

                // Clear inputs for nodes that were receiving data from this deleted node
                setNodes((existingNodes) =>
                    existingNodes.map((node) => {
                        // Check if this node was receiving input from the deleted node
                        const wasReceivingFromDeleted = edgeConnectionsRef.current.some(
                            (edge) => edge.source === deletedNode.id && edge.target === node.id
                        );

                        if (wasReceivingFromDeleted) {
                            return updateNodeData(node, {input: undefined}, nodeAssertions);
                        }

                        return node;
                    })
                );
            });
        },
        [setNodes]
    );

    // Update node configuration
    const handleNodeConfigChange = useCallback((nodeId: string, newPartialData: Record<string, any>) => {
        setNodes((currentNodes) =>
            currentNodes.map((node) =>
                node.id === nodeId
                    ? updateNodeData(node, newPartialData, nodeAssertions)
                    : node
            )
        );
    }, [setNodes]);

    // Store node execution results
    const handleNodeResultUpdate = useCallback((nodeId: string, input: any) => {
        setResults((prev) => new Map(prev.set(nodeId, input)));

        setNodes((existingNodes) =>
            existingNodes.map((node) => {
                const hasIncoming = edgeConnectionsRef.current.some(
                    (edge) => edge.source === nodeId && edge.target === node.id
                );

                if (!hasIncoming) return node;

                return updateNodeData(node, {input, feedback: undefined}, nodeAssertions);
            })
        );
    }, [setNodes]);

    const handleFeedbackSend = useCallback((fromNodeId: string, feedback: string) => {
        setNodes((existingNodes) =>
            existingNodes.map((node) => {
                // Find the source node that sent data to the current node
                const hasIncomingFromSource = edgeConnectionsRef.current.some(
                    (edge) => edge.target === fromNodeId && edge.source === node.id
                );

                if (!hasIncomingFromSource || node.type !== LLM_NODE_TYPE) return node;

                return updateNodeData(node, {feedback}, nodeAssertions);
            })
        );
    }, [setNodes]);

    // Enhance nodes with handlers
    const enhancedNodes: AppNode[] = nodes.map((node) =>
        updateNodeData(node, {
            onConfigChange: handleNodeConfigChange,
            onResultUpdate: handleNodeResultUpdate,
            onFeedbackSend: handleFeedbackSend,
        }, nodeAssertions)
    );

    const addNode = useCallback(
        (node: AppNode) => setNodes((existingNodes) => [...existingNodes, node]),
        [setNodes],
    );

    return {
        nodes: enhancedNodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onEdgesDelete,
        onNodesDelete,
        onConnect,
        addNode,
        results,
        setNodes,
        setEdges
    };
}