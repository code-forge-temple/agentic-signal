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
import {Dock} from '../Dock';
import {v4 as uuidv4} from 'uuid';
import {useSnackbar} from 'notistack'
import { AppNodeType } from '../nodes/workflow.gen';
import { toolRegistry } from '../nodes/ToolNode/tools/toolRegistry.gen';
import {nodeRegistry} from '../nodes/nodeRegistry.gen';
import {NODE_TYPE as TOOL_NODE_TYPE} from '../nodes/ToolNode/constants';


const getId = () => uuidv4();

function deleteByPath(obj: Record<string, any>, path: string): void {
    const parts = path.split(".");
    if (parts.length === 1) {
        delete obj[parts[0]];
    } else {
        let current: any = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current || typeof current !== "object") return;
            current = current[parts[i]];
        }
        if (current && typeof current === "object") {
            delete current[parts[parts.length - 1]];
        }
    }
}

const descriptorMap = Object.fromEntries(
    nodeRegistry.map(desc => [desc.type, desc])
);

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
    const { enqueueSnackbar } = useSnackbar();

    const handleSave = () => {
        const sanitizedNodes = nodes.map(node => {
            const nodeData = JSON.parse(JSON.stringify(node.data));
            const toSanitize = Array.isArray(nodeData.toSanitize) ? nodeData.toSanitize : [];
            
            for (const path of toSanitize) {
                deleteByPath(nodeData, path);
            }
            
            deleteByPath(nodeData, "toSanitize");

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

        enqueueSnackbar('Workflow saved!', { variant: 'success' });
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

                if (!data.nodes || !Array.isArray(data.nodes)) {
                    enqueueSnackbar("Invalid workflow file: missing or invalid 'nodes' array.", { variant: 'error' });
                    
                    return;
                }

                let nodesHidrationError = "";

                const hydratedNodes = data.nodes.map((node: any) => {
                    if(nodesHidrationError) return;

                    if (!node.type || !node.data) {                       
                        nodesHidrationError = "Invalid workflow file: missing or invalid '<node>.data' and/or <node>.type";

                        return;
                    }

                    const descriptor = descriptorMap[node.type];
                    let updatedNode = node;

                    if (node.type === TOOL_NODE_TYPE) {
                        const tool = toolRegistry.find(t => t.toolSubtype === node.data.toolSubtype);

                        if (tool) {
                            updatedNode = {
                                ...node,
                                data: {
                                    ...node.data,
                                    toolSchema: tool.toolSchema,
                                    title: tool.title,
                                    handler: undefined,
                                    toSanitize: [...descriptor?.defaultData.toSanitize, ...tool.toSanitize]
                                }
                            };
                        } else {
                            updatedNode = {
                                ...node,
                                data: {
                                    ...node.data,
                                    toolSchema: {},
                                    title: descriptor?.defaultData.title || node.data.title,
                                    handler: undefined,
                                    toSanitize: [...descriptor?.defaultData.toSanitize]
                                }
                            };
                        }
                    } else {
                        updatedNode = {
                            ...node,
                            data: {
                                ...node.data,
                                title: descriptor?.defaultData.title || node.data.title,
                                toSanitize: descriptor?.defaultData.toSanitize
                            }
                        };
                    }

                    return updatedNode;
                });

                if (nodesHidrationError) {
                    enqueueSnackbar(nodesHidrationError, { variant: 'error' });

                    return;
                }

                setNodes(hydratedNodes);
                setEdges(data.edges || []);

                event.target.value = '';
            } catch (error) {
                enqueueSnackbar('Failed to load workflow: ' + (error instanceof Error ? error.message : String(error)), { variant: 'error' });
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

            const nodeType = event.dataTransfer.getData('application/reactflow') as AppNodeType;

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