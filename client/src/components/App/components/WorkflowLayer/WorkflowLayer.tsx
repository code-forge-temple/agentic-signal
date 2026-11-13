/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactFlow, Background, Controls, MiniMap, BackgroundVariant} from '@xyflow/react';
import './WorkflowLayer.scss';
import {useWorkflow} from '../../../../hooks/useWorkflow';
import {nodeTypes} from '../../../nodes';
import {DEFAULT_EDGE_TYPE, edgeTypes} from '../../../edges';
import {RefObject, useCallback, useMemo} from 'react';
import {useSnackbar} from 'notistack'
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import {LAYER_KIND, Layer} from '../../../../context/LayersContextBase';
import {WorkflowLayerContext} from '../../../../context/WorkflowLayerContext';
import {findWorkflowCommand} from '../../../../workflows';
import {downloadWorkflow, workflowToJson} from './utils/workflowFile';
import {useFitViewOnLoad} from './hooks/useFitViewOnLoad';
import {useWorkflowLoading} from './hooks/useWorkflowLoading';
import {useNodeDrop} from './hooks/useNodeDrop';
import {useRegisterLayerApi} from './hooks/useRegisterLayerApi';
import {useInitialWorkflow} from './hooks/useInitialWorkflow';
import {LoadWorkflowQuestion} from './components/LoadWorkflowQuestion';


// React Flow listens for its keys on the whole document, once per canvas: a hidden layer
// would otherwise delete its selected nodes when Delete is pressed on the shown one.
const HIDDEN_LAYER_KEY_CODES = {
    selectionKeyCode: null,
    multiSelectionKeyCode: null,
    panActivationKeyCode: null,
    zoomActivationKeyCode: null,
};

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
    const readOnly = layer.kind === LAYER_KIND.AI;
    const {fitViewPadding, fitViewOnLoad} = useFitViewOnLoad(dockRef, nodes);
    const {isLoading, loadWorkflowFromJson, replaceWorkflow, question} = useWorkflowLoading({layer, readOnly, nodes, setNodes, setEdges, fitViewOnLoad});
    const {onDragOver, onDrop} = useNodeDrop(addNode, readOnly);

    const getWorkflowJson = useCallback(() => workflowToJson(nodes, edges), [nodes, edges]);

    const save = () => {
        if (nodes.length === 0 && edges.length === 0) {
            enqueueSnackbar('Nothing to save.', {variant: 'info'});

            return;
        }

        const json = getWorkflowJson();
        // The AI Buddy layer's name says nothing about what it holds: name the file after the command it ran.
        const command = readOnly ? findWorkflowCommand(JSON.parse(json))?.command : undefined;

        downloadWorkflow(json, command ?? layer.name);
        enqueueSnackbar('Workflow saved!', {variant: 'success'});
    };

    const clear = () => {
        setNodes([]);
        setEdges([]);
    };

    useRegisterLayerApi(layer.id, {save, clear, loadWorkflowFromJson, replaceWorkflow, getWorkflowJson, hasNodes: () => nodes.length > 0});
    // After the registration, so a new layer can be reached before its workflow starts loading.
    useInitialWorkflow(layer.id, loadWorkflowFromJson);

    const layerContext = useMemo(() => ({
        isActive,
        layerId: layer.id,
        isAiLayer: readOnly,
    }), [isActive, layer.id, readOnly]);

    return (
        <WorkflowLayerContext.Provider value={layerContext}>
            <div className={`workflow-layer${isActive ? '' : ' workflow-layer-hidden'}`} inert={!isActive}>
                <Backdrop open={isLoading} sx={{zIndex: 9999, color: '#fff'}}>
                    <CircularProgress color="inherit" />
                </Backdrop>
                <LoadWorkflowQuestion question={question} readOnly={readOnly} />
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
                    <Controls fitViewOptions={{padding: fitViewPadding()}} showInteractive={!readOnly} />
                </ReactFlow>
            </div>
        </WorkflowLayerContext.Provider>
    );
}
