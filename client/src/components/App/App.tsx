/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactFlow, Background, Controls, MiniMap, BackgroundVariant, useReactFlow, ReactFlowProvider} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.scss';

import {useWorkflow} from '../../hooks/useWorkflow';
import {nodeFactory, nodeTypes} from '../nodes';
import {useCallback} from 'react';
import {TaskNodeType} from '../../constants';
import {Dock} from '../Dock';
import {v4 as uuidv4} from 'uuid';
import {toolRegistry} from '../nodes/ToolNode';

const getId = () => uuidv4();


function AppFlow () {
    const {
        nodes,
        edges,
        addNode,
        onNodesChange,
        onEdgesChange,
        onEdgesDelete,
        onNodesDelete,
        onConnect,
        setNodes,
        setEdges,
    } = useWorkflow();

    const handleSave = () => {
        const sanitizedNodes = nodes.map(node => {
            const nodeData = JSON.parse(JSON.stringify(node.data));

            delete nodeData.input;
            delete nodeData?.conversationHistory;
            delete nodeData?.userConfig?.accessToken;
            delete nodeData?.feedback;
            delete nodeData?.handler;
            delete nodeData?.toolSchema;

            return {
                ...node,
                data: nodeData
            };
        });

        const data = JSON.stringify({nodes: sanitizedNodes, edges}, null, 4);
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "workflow.json";
        a.click();

        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        setNodes([]);
        setEdges([]);
    };

    const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                const hydratedNodes = data.nodes.map((node: any) => {
                    if (node.type === 'ai-tool' && node.data.toolSubtype) {
                        const tool = toolRegistry.find(t => t.toolSubtype === node.data.toolSubtype);

                        if (tool) {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    toolSchema: tool.toolSchema,
                                    title: tool.title,
                                    handler: undefined
                                }
                            };
                        }
                    }

                    return node;
                });

                setNodes(hydratedNodes);
                setEdges(data.edges || []);
            } catch (error) {
                console.error('Failed to load workflow:', error);
            }
        };
        reader.readAsText(file);
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const reactFlowInstance = useReactFlow();

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const nodeType = event.dataTransfer.getData('application/reactflow') as TaskNodeType;

            if (typeof nodeType === 'undefined' || !nodeType) {
                return;
            }

            const zoom = reactFlowInstance.getZoom?.() ?? 1;
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX - 20 * zoom,
                y: event.clientY - 20 * zoom,
            });

            addNode(nodeFactory(nodeType, getId(), position));
        }, [addNode, reactFlowInstance]);

    return (
        <>
            <Dock onSave={handleSave} onLoad={handleLoad} onClear={handleClear} />
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgesDelete={onEdgesDelete}
                onNodesDelete={onNodesDelete}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: false
                }}
                colorMode={'dark'}
                deleteKeyCode="Delete"
                defaultViewport={{x: 0, y: 0, zoom: 2}}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="#333"
                />
                <MiniMap />
                <Controls />
            </ReactFlow>
        </>
    );
}

export function App () {
    return (
        <div style={{width: '100vw', height: '100vh', position: 'relative'}}>
            <ReactFlowProvider>
                <AppFlow />
            </ReactFlowProvider>
        </div>
    );
}