/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactFlow, Background, Controls, MiniMap, BackgroundVariant, useReactFlow, useNodesInitialized, FitViewOptions, Edge} from '@xyflow/react';
import {flushSync} from 'react-dom';
import './WorkflowLayer.scss';
import {useWorkflow} from '../../../../hooks/useWorkflow';
import {nodeFactory, nodeTypes} from '../../../nodes';
import {DEFAULT_EDGE_TYPE, edgeTypes} from '../../../edges';
import {RefObject, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {v4 as uuidv4} from 'uuid';
import {useSnackbar} from 'notistack'
import {AppNode, AppNodeType} from '../../../nodes/workflow.gen';
import {NodeDescriptor} from '../../../nodes/types';
import {ElbowEdgeData} from '../../../edges/ElbowEdge/ElbowEdge';
import {toolRegistry} from '../../../nodes/ToolNode/tools/toolRegistry.gen';
import {nodeRegistry} from '../../../nodes/nodeRegistry.gen';
import {NODE_TYPE as TOOL_NODE_TYPE} from '../../../nodes/ToolNode/constants';
import {assertValidWorkflowEdges} from '../../utils/workflowUtils';
import {getDefaultUserConfigValues} from '../../../../types/ollama.types';
import {z} from 'zod';
import {Backdrop, CircularProgress} from '@mui/material';
import {ConfirmDialog} from '../../../ConfirmDialog';
import {isRecord} from '../../../../utils';
import {useLayers} from '../../../../hooks/useLayers';
import {useLatestValue} from '../../../../hooks/useLatestValue';
import {AI_LAYER_READ_ONLY_HINT, isDefaultLayerName, LAYER_KIND, Layer, LoadWorkflowOptions} from '../../../../context/LayersContextBase';
import {WorkflowLayerContext} from '../../../../context/WorkflowLayerContext';
import {findWorkflowCommand, layerNameFromFileName} from '../../../../workflows';
import {errorMessage} from '@shared/utils';


const ZOD_PATH_SEPARATOR = '→';

const FIT_VIEW_TOP_BUFFER_PX = 16;

// React Flow listens for its keys on the whole document, once per canvas: a hidden layer
// would otherwise delete its selected nodes when Delete is pressed on the shown one.
const HIDDEN_LAYER_KEY_CODES = {
    selectionKeyCode: null,
    multiSelectionKeyCode: null,
    panActivationKeyCode: null,
    zoomActivationKeyCode: null,
};

// Characters Windows, macOS or Linux refuse in a file name.
const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]/g;

const getId = () => uuidv4();

function deleteByPath (obj: Record<string, unknown>, path: string): void {
    const parts = path.split(".");

    if (parts.length === 1) {
        delete obj[parts[0]];
    } else {
        let current: unknown = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!isRecord(current)) return;

            current = current[parts[i]];
        }

        if (isRecord(current)) {
            delete current[parts[parts.length - 1]];
        }
    }
}

function remapNodeAndEdgeIds<
    N extends { id: string },
    E extends { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }
> (nodes: N[], edges: E[]) {
    const idMap = new Map<string, string>(
        nodes.map(node => [node.id, getId()])
    );

    const remappedNodes = nodes.map(node => ({
        ...node,
        id: idMap.get(node.id)!
    }));

    const remappedEdges = edges.map(edge => {
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

type LoadableNodeDescriptor = NodeDescriptor<string, { data: { title?: string; toSanitize?: string[] } }>;

const descriptorMap: Record<string, LoadableNodeDescriptor | undefined> = Object.fromEntries(
    nodeRegistry.map(desc => [desc.type, desc])
);

const NodeSchema = z.object({
    id: z.string().min(1, '"id" must be a non-empty string'),
    type: z.string().min(1, '"type" must be a non-empty string'),
    data: z.record(z.unknown()),
    position: z.object({x: z.number(), y: z.number()}, {required_error: '"position" with {x, y} is required'}),
}).passthrough();

const EdgeSchema = z.object({
    source: z.string().min(1, '"source" must be a non-empty string'),
    target: z.string().min(1, '"target" must be a non-empty string'),
}).passthrough();

const WorkflowSchema = z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema).optional().default([]),
});

/** Validates and hydrates a workflow JSON into nodes and edges with fresh ids. Throws on anything invalid. */
function parseWorkflowJson (jsonString: string): {nodes: AppNode[]; edges: Edge[]} {
    const raw = JSON.parse(jsonString) as { nodes?: unknown };

    // Auto-assign positions for nodes missing them (models often omit position)
    if (Array.isArray(raw.nodes)) {
        raw.nodes = (raw.nodes as { position?: { x?: unknown; y?: unknown } }[]).map((node, idx) => {
            const x = typeof node.position?.x === 'number' ? node.position.x : idx * 300;
            const y = typeof node.position?.y === 'number' ? node.position.y : 0;

            return {...node, position: {x, y}};
        });
    }

    const {nodes: parsedNodes, edges: parsedEdgesRaw} = WorkflowSchema.parse(raw);

    const parsedEdges = parsedEdgesRaw.map(edge => ({...edge, type: DEFAULT_EDGE_TYPE}));

    assertValidWorkflowEdges(parsedNodes, parsedEdges);

    const hydratedNodes = parsedNodes.map((node, idx) => {
        if (!descriptorMap[node.type]) {
            const valid = Object.keys(descriptorMap).join(', ');

            throw new Error(`unknown node type "${node.type}". Valid types are: ${valid}`);
        }

        const descriptor = descriptorMap[node.type];

        if (descriptor?.migrate) {
            node = {...node, data: descriptor.migrate(node.data)};
        }

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
                            ...(node.data.userConfig as Record<string, unknown> | undefined)
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

        try {
            descriptor?.assertion(updatedNode.data);
        } catch (assertionError) {
            if (assertionError instanceof z.ZodError) {

                const fields = assertionError.errors.map(e => {
                    const path = ['data', ...e.path].join(ZOD_PATH_SEPARATOR);

                    return `${path}: ${e.message}`;
                }).join('; ');

                throw new Error(`nodes[${idx}] (type "${node.type}"): ${fields}`);
            }

            throw assertionError;
        }

        // The descriptor's assertion has just validated this node's data.
        return updatedNode as AppNode;
    });

    const {remappedNodes, remappedEdges} = remapNodeAndEdgeIds(hydratedNodes, parsedEdges);

    return {nodes: remappedNodes, edges: remappedEdges};
}

function describeLoadError (error: unknown): string {
    if (error instanceof z.ZodError) {
        return error.errors.map(e => {
            const path = e.path.join(ZOD_PATH_SEPARATOR);

            return path ? `${path}: ${e.message}` : e.message;
        }).join('; ');
    }

    return errorMessage(error);
}

/** A workflow waiting on the user's choice: add it to this one, replace this one, or open it in a new layer. */
type PendingWorkflow = {nodes: AppNode[]; edges: Edge[]; json: string; fileName?: string};

type WorkflowLayerProps = {
    layer: Layer;
    isActive: boolean;
    dockRef: RefObject<HTMLDivElement | null>;
};

/* One workflow canvas. Every layer stays mounted while it exists, shown or not: the nodes run
 * their workflow from their own components, so unmounting a layer would stop it.
 */
export function WorkflowLayer ({layer, isActive, dockRef}: WorkflowLayerProps) {
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
    const {registerLayerApi, addLayer, renameLayer, takeInitialWorkflow} = useLayers();
    const [pendingWorkflow, setPendingWorkflow] = useState<PendingWorkflow | null>(null);
    const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
    const reactFlowInstance = useReactFlow();
    const nodesInitialized = useNodesInitialized();
    const fitViewOnLoadRef = useRef(false);
    const readOnly = layer.kind === LAYER_KIND.AI;

    // Measured rather than hardcoded: the dock's height isn't fixed (it can wrap/resize with its
    // content), so a constant would drift out of sync and let nodes end up hidden behind it again.
    const getFitViewPadding = useCallback((): FitViewOptions['padding'] => {
        const dockHeight = dockRef.current?.getBoundingClientRect().height ?? 0;

        return {top: `${dockHeight + FIT_VIEW_TOP_BUFFER_PX}px`, x: '20%', bottom: '20%'};
    }, [dockRef]);

    useEffect(() => {
        if (nodesInitialized && fitViewOnLoadRef.current) {
            fitViewOnLoadRef.current = false;
            void reactFlowInstance.fitView({padding: getFitViewPadding(), duration: 400});
        }
        // `nodes` is intentionally included: replacing an existing workflow keeps
        // nodesInitialized `true` throughout (no false->true edge to react to), so
        // this effect must also re-run whenever the node set itself changes.
    }, [nodesInitialized, nodes, reactFlowInstance, getFitViewPadding]);

    const handleGetWorkflowJson = useCallback((): string => {
        const sanitizedNodes = nodes.map(node => {
            const nodeData = JSON.parse(JSON.stringify(node.data)) as Record<string, unknown>;
            const toSanitize = Array.isArray(nodeData.toSanitize) ? nodeData.toSanitize as string[] : [];

            for (const path of toSanitize) {
                deleteByPath(nodeData, path);
            }

            deleteByPath(nodeData, "toSanitize");

            return {
                ...node,
                data: nodeData
            };
        });

        return JSON.stringify({nodes: sanitizedNodes, edges}, null, 4);
    }, [nodes, edges]);

    const handleSave = () => {
        if (nodes.length === 0 && edges.length === 0) {
            enqueueSnackbar('Nothing to save.', {variant: 'info'});

            return;
        }

        const data = handleGetWorkflowJson();
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        // The AI Buddy layer's name says nothing about what it holds: name the file after the command it ran.
        const command = readOnly ? findWorkflowCommand(JSON.parse(data))?.command : undefined;

        a.href = url;
        a.download = `${(command ?? layer.name).replace(FILE_NAME_FORBIDDEN_CHARS, '_')}.json`;
        a.click();

        URL.revokeObjectURL(url);

        enqueueSnackbar('Workflow saved!', {variant: 'success'});
    };

    const handleClear = () => {
        setNodes([]);
        setEdges([]);
    };

    // A file that becomes the layer's whole workflow names it, unless the layer was named already.
    const nameAfterFile = useCallback((fileName: string | undefined) => {
        const name = fileName ? layerNameFromFileName(fileName) : "";

        if (name && isDefaultLayerName(layer.name)) renameLayer(layer.id, name);
    }, [layer.id, layer.name, renameLayer]);

    const handleLoadWorkflowFromJson = useCallback((jsonString: string, {onError, fileName}: LoadWorkflowOptions = {}) => {
        flushSync(() => setIsLoadingWorkflow(true));

        setTimeout(() => {
            try {
                const {nodes: loadedNodes, edges: loadedEdges} = parseWorkflowJson(jsonString);

                // The AI Buddy layer takes no workflow from the user: the question offers a new layer instead.
                if (readOnly || nodes.length > 0) {
                    setPendingWorkflow({nodes: loadedNodes, edges: loadedEdges, json: jsonString, fileName});
                } else {
                    fitViewOnLoadRef.current = true;

                    setNodes(loadedNodes);
                    setEdges(loadedEdges);
                    nameAfterFile(fileName);
                }
            } catch (error) {
                const message = 'Failed to load workflow: ' + describeLoadError(error);

                enqueueSnackbar(message, {variant: 'error'});
                onError?.(message);
            } finally {
                setIsLoadingWorkflow(false);
            }
        }, 100);
    }, [readOnly, nodes, setNodes, setEdges, enqueueSnackbar, nameAfterFile]);

    const handleReplaceWorkflowFromJson = useCallback((jsonString: string) => {
        let workflow: ReturnType<typeof parseWorkflowJson>;

        try {
            workflow = parseWorkflowJson(jsonString);
        } catch (error) {
            throw new Error(describeLoadError(error));
        }

        fitViewOnLoadRef.current = true;

        setNodes(workflow.nodes);
        setEdges(workflow.edges);
    }, [setNodes, setEdges]);

    // The dock and the AI Assistant live outside the layers and reach the active one through this.
    const latestApiRef = useLatestValue({
        save: handleSave,
        clear: handleClear,
        loadWorkflowFromJson: handleLoadWorkflowFromJson,
        replaceWorkflow: handleReplaceWorkflowFromJson,
        getWorkflowJson: handleGetWorkflowJson,
        hasNodes: () => nodes.length > 0,
    });

    useEffect(() => registerLayerApi(layer.id, {
        save: () => latestApiRef.current.save(),
        clear: () => latestApiRef.current.clear(),
        loadWorkflowFromJson: (json, options) => latestApiRef.current.loadWorkflowFromJson(json, options),
        replaceWorkflow: (json) => latestApiRef.current.replaceWorkflow(json),
        getWorkflowJson: () => latestApiRef.current.getWorkflowJson(),
        hasNodes: () => latestApiRef.current.hasNodes(),
    }), [layer.id, registerLayerApi, latestApiRef]);

    // A layer made to hold a loaded workflow (Add to New Layer in the load question) loads it once mounted.
    useEffect(() => {
        const json = takeInitialWorkflow(layer.id);

        if (json !== undefined) handleLoadWorkflowFromJson(json);
    }, [layer.id, takeInitialWorkflow, handleLoadWorkflowFromJson]);

    const handleMergeWorkflow = () => {
        if (!pendingWorkflow) return;

        const pending = pendingWorkflow;

        flushSync(() => {
            setPendingWorkflow(null);
            setIsLoadingWorkflow(true);
        });

        setTimeout(() => {
            try {
                const maxY = Math.max(...nodes.map(n => n.position.y + (n.measured?.height ?? 40)));
                const minX = Math.min(...nodes.map(n => n.position.x));
                const yOffset = maxY + 100;
                const pendingMinY = Math.min(...pending.nodes.map(n => n.position.y));
                const pendingMinX = Math.min(...pending.nodes.map(n => n.position.x));
                const dx = minX - pendingMinX;
                const dy = yOffset - pendingMinY;

                const shiftedNodes = pending.nodes.map(node => ({
                    ...node,
                    position: {
                        x: node.position.x + dx,
                        y: node.position.y + dy
                    }
                }));

                const shiftedEdges = pending.edges.map(edge => {
                    const bend = (edge.data as ElbowEdgeData | undefined)?.bend;

                    if (!bend) return edge;

                    return {
                        ...edge,
                        data: {...edge.data, bend: {x: bend.x + dx, y: bend.y + dy}}
                    };
                });

                setNodes([...nodes, ...shiftedNodes]);
                setEdges([...edges, ...shiftedEdges]);
            } finally {
                setIsLoadingWorkflow(false);
            }
        }, 100);
    };

    const handleReplaceWorkflow = () => {
        if (!pendingWorkflow) return;

        flushSync(() => {
            setPendingWorkflow(null);
            setIsLoadingWorkflow(true);
        });

        setTimeout(() => {
            try {
                fitViewOnLoadRef.current = true;

                setNodes(pendingWorkflow.nodes);
                setEdges(pendingWorkflow.edges);
                nameAfterFile(pendingWorkflow.fileName);
            } finally {
                setIsLoadingWorkflow(false);
            }
        }, 100);
    };

    // The loaded workflow gets a layer of its own; this one is left as it is, running or not.
    const handleLoadIntoNewLayer = () => {
        if (!pendingWorkflow) return;

        const name = pendingWorkflow.fileName ? layerNameFromFileName(pendingWorkflow.fileName) : "";

        setPendingWorkflow(null);
        addLayer({name: name || undefined, workflowJson: pendingWorkflow.json});
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = readOnly ? 'none' : 'move';
    }, [readOnly]);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            if (readOnly) return;

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
        }, [addNode, reactFlowInstance, readOnly]);

    const layerContext = useMemo(() => ({
        isActive,
        layerId: layer.id,
        isAiLayer: layer.kind === LAYER_KIND.AI,
    }), [isActive, layer.id, layer.kind]);

    return (
        <WorkflowLayerContext.Provider value={layerContext}>
            <div className={`workflow-layer${isActive ? '' : ' workflow-layer-hidden'}`} inert={!isActive}>
                <Backdrop open={isLoadingWorkflow} sx={{zIndex: 9999, color: '#fff'}}>
                    <CircularProgress color="inherit" />
                </Backdrop>
                <ConfirmDialog
                    open={pendingWorkflow !== null}
                    onClose={() => setPendingWorkflow(null)}
                    title="Load Workflow"
                    width={700}
                    maximizable={false}
                    message={readOnly
                        ? `Can't import into this layer: ${AI_LAYER_READ_ONLY_HINT}. Import it into a new layer instead?`
                        : "A workflow is already loaded. Would you like to add to the existing workflow, replace it, or open the loaded one in a new layer?"}
                    confirmLabel="Add to New Layer"
                    onConfirm={handleLoadIntoNewLayer}
                    extraActions={readOnly ? undefined : [
                        {label: "Replace Existing", onClick: handleReplaceWorkflow},
                        {label: "Add to Existing", onClick: handleMergeWorkflow},
                    ]}
                />
                <ReactFlow
                    id={layer.id}
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
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={{
                        type: DEFAULT_EDGE_TYPE,
                        animated: false
                    }}
                    colorMode={'dark'}
                    deleteKeyCode={isActive && !readOnly ? 'Delete' : null}
                    {...(!isActive && HIDDEN_LAYER_KEY_CODES)}
                    nodesDraggable={!readOnly}
                    nodesConnectable={!readOnly}
                    elementsSelectable={!readOnly}
                    edgesReconnectable={!readOnly}
                    defaultViewport={{x: 0, y: 0, zoom: 2}}
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={16}
                        size={1}
                        color="#333"
                    />
                    <MiniMap />
                    <Controls fitViewOptions={{padding: getFitViewPadding()}} showInteractive={!readOnly} />
                </ReactFlow>
            </div>
        </WorkflowLayerContext.Provider>
    );
}
