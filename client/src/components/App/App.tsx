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
import {useCallback, useState} from 'react';
import {Dock} from '../Dock';
import {v4 as uuidv4} from 'uuid';
import {useSnackbar} from 'notistack'
import {AppNodeType} from '../nodes/workflow.gen';
import {toolRegistry} from '../nodes/ToolNode/tools/toolRegistry.gen';
import {nodeRegistry} from '../nodes/nodeRegistry.gen';
import {NODE_TYPE as TOOL_NODE_TYPE} from '../nodes/ToolNode/constants';
import {useFullscreen} from '../../hooks/useFullscreen';
import {getDefaultUserConfigValues} from '../../types/ollama.types';
import {Chip} from '@mui/material';
import {ConfirmDialog} from '../ConfirmDialog';


const getId = () => uuidv4();

function deleteByPath (obj: Record<string, any>, path: string): void {
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

function remapNodeAndEdgeIds (nodes: any[], edges: any[]) {
    const idMap = new Map<string, string>(
        nodes.map((node: any) => [node.id, getId()])
    );

    const remappedNodes = nodes.map((node: any) => ({
        ...node,
        id: idMap.get(node.id)!
    }));

    const remappedEdges = edges.map((edge: any) => {
        const newSource = idMap.get(edge.source) ?? edge.source;
        const newTarget = idMap.get(edge.target) ?? edge.target;
        const newId = `xy-edge__${newSource}${edge.sourceHandle ?? ''}-${newTarget}${edge.targetHandle ?? ''}`;

        return {
            ...edge,
            source: newSource,
            target: newTarget,
            id: newId
        };
    });

    return {remappedNodes, remappedEdges};
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
    const {enqueueSnackbar} = useSnackbar();
    const [pendingWorkflow, setPendingWorkflow] = useState<{nodes: any[], edges: any[]} | null>(null);

    useFullscreen();

    const handleSave = () => {
        if (nodes.length === 0 && edges.length === 0) {
            enqueueSnackbar('Nothing to save.', {variant: 'info'});

            return;
        }

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

        enqueueSnackbar('Workflow saved!', {variant: 'success'});
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
                    throw new Error("missing or invalid 'nodes' array.");
                }

                const hydratedNodes = data.nodes.map((node: any) => {
                    if (!node.type || !node.data) {
                        throw new Error("missing or invalid <node>.data or <node>.type");
                    }

                    const descriptor = descriptorMap[node.type];
                    let updatedNode = node;

                    if (node.type === TOOL_NODE_TYPE) {
                        const tool = toolRegistry.find(t => t.toolSubtype === node.data.toolSubtype);

                        if (tool) {
                            const defaultUserConfig = getDefaultUserConfigValues(tool.userConfigSchema || {});

                            updatedNode = {
                                ...node,
                                data: {
                                    ...node.data,
                                    toolSchema: tool.toolSchema,
                                    userConfigSchema: tool.userConfigSchema,
                                    userConfig: {
                                        ...defaultUserConfig,
                                        ...node.data.userConfig
                                    },
                                    title: tool.title,
                                    handler: undefined,
                                    toSanitize: [...descriptor?.defaultData.toSanitize || [], ...tool.toSanitize]
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
                                    toSanitize: [...descriptor?.defaultData.toSanitize || []]
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

                    descriptor?.assertion(updatedNode.data);

                    return updatedNode;
                });

                const {remappedNodes, remappedEdges} = remapNodeAndEdgeIds(hydratedNodes, data.edges || []);

                if (nodes.length > 0) {
                    setPendingWorkflow({nodes: remappedNodes, edges: remappedEdges});
                } else {
                    setNodes(remappedNodes);
                    setEdges(remappedEdges);
                }
            } catch (error) {
                enqueueSnackbar('Failed to load workflow: ' + (error instanceof Error ? error.message : String(error)), {variant: 'error'});
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleMergeWorkflow = () => {
        if (!pendingWorkflow) return;

        const maxY = Math.max(...nodes.map(n => n.position.y + (n.measured?.height ?? 40)));
        const minX = Math.min(...nodes.map(n => n.position.x));
        const yOffset = maxY + 100;
        const pendingMinY = Math.min(...pendingWorkflow.nodes.map((n: any) => n.position.y));
        const pendingMinX = Math.min(...pendingWorkflow.nodes.map((n: any) => n.position.x));
        const shiftedNodes = pendingWorkflow.nodes.map((node: any) => ({
            ...node,
            position: {
                x: node.position.x - pendingMinX + minX,
                y: node.position.y + yOffset - pendingMinY}
        }));

        setNodes([...nodes, ...shiftedNodes]);
        setEdges([...edges, ...pendingWorkflow.edges]);
    };

    const handleReplaceWorkflow = () => {
        if (!pendingWorkflow) return;

        setNodes(pendingWorkflow.nodes);
        setEdges(pendingWorkflow.edges);
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
            <ConfirmDialog
                open={pendingWorkflow !== null}
                onClose={() => setPendingWorkflow(null)}
                title="Load Workflow"
                message="A workflow is already loaded. Would you like to add to the existing workflow or replace it?"
                confirmLabel="Add to Existing"
                cancelLabel="Replace"
                onConfirm={handleMergeWorkflow}
                onCancel={handleReplaceWorkflow}
            />
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
            <Chip
                label={`v${__APP_VERSION__}`}
                size="small"
                className="version-tag"
            />
            <ReactFlowProvider>
                <AppFlow />
            </ReactFlowProvider>
        </div>
    );
}