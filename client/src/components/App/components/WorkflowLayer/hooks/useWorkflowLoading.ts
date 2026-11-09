/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Dispatch, SetStateAction, useCallback, useState} from 'react';
import {Edge} from '@xyflow/react';
import {useSnackbar} from 'notistack';
import {AppNode} from '../../../../nodes/workflow.gen';
import {useLayers} from '../../../../../hooks/useLayers';
import {isDefaultLayerName, Layer, LoadWorkflowOptions} from '../../../../../context/LayersContextBase';
import {layerNameFromFileName} from '../../../../../workflows';
import {describeLoadError, parseWorkflowJson} from '../utils/parseWorkflow';
import {placeBelow} from '../utils/mergeWorkflow';
import {Workflow} from '../types';
import {useLoadingOverlay} from './useLoadingOverlay';


/** A workflow waiting on the user's choice: add it to this one, replace this one, or open it in a new layer. */
type PendingWorkflow = Workflow & {json: string; fileName?: string};

type WorkflowLoadingOptions = Pick<Workflow, 'nodes'> & {
    layer: Layer;
    readOnly: boolean;
    setNodes: Dispatch<SetStateAction<AppNode[]>>;
    setEdges: Dispatch<SetStateAction<Edge[]>>;
    fitViewOnLoad: () => void;
};

/** The question a workflow loaded over another one asks, and its answers. */
export type LoadQuestion = {
    open: boolean;
    close: () => void;
    merge: () => void;
    replace: () => void;
    loadIntoNewLayer: () => void;
};

// The layer name a workflow file gives; none without a file.
const layerNameOf = (fileName: string | undefined) => (fileName ? layerNameFromFileName(fileName) : "");

/**
 * Loading a workflow into the layer: straight in when the layer is empty, otherwise after the load question; and, for
 * the AI Buddy, a replace with no question.
 */
export function useWorkflowLoading ({layer, readOnly, nodes, setNodes, setEdges, fitViewOnLoad}: WorkflowLoadingOptions) {
    const {enqueueSnackbar} = useSnackbar();
    const {addLayer, renameLayer} = useLayers();
    const [pendingWorkflow, setPendingWorkflow] = useState<PendingWorkflow | null>(null);
    const [isLoading, whileLoading] = useLoadingOverlay();

    // A file that becomes the layer's whole workflow names it, unless the layer was named already.
    const nameAfterFile = useCallback((fileName: string | undefined) => {
        const name = layerNameOf(fileName);

        if (name && isDefaultLayerName(layer.name)) renameLayer(layer.id, name);
    }, [layer.id, layer.name, renameLayer]);

    const showWorkflow = useCallback((workflow: Workflow, fileName?: string) => {
        fitViewOnLoad();
        setNodes(workflow.nodes);
        setEdges(workflow.edges);
        nameAfterFile(fileName);
    }, [fitViewOnLoad, setNodes, setEdges, nameAfterFile]);

    const loadWorkflowFromJson = useCallback((json: string, {onError, fileName}: LoadWorkflowOptions = {}) => whileLoading(() => {
        try {
            const workflow = parseWorkflowJson(json);

            // The AI Buddy layer takes no workflow from the user: the question offers a new layer instead.
            if (readOnly || nodes.length > 0) setPendingWorkflow({...workflow, json, fileName});
            else showWorkflow(workflow, fileName);
        } catch (error) {
            const message = 'Failed to load workflow: ' + describeLoadError(error);

            enqueueSnackbar(message, {variant: 'error'});
            onError?.(message);
        }
    }), [whileLoading, readOnly, nodes, showWorkflow, enqueueSnackbar]);

    const replaceWorkflow = useCallback((json: string) => {
        let workflow: Workflow;

        try {
            workflow = parseWorkflowJson(json);
        } catch (error) {
            throw new Error(describeLoadError(error));
        }

        showWorkflow(workflow);
    }, [showWorkflow]);

    const question = useLoadQuestion({pendingWorkflow, setPendingWorkflow, whileLoading, showWorkflow, addLayer, nodes, setNodes, setEdges});

    return {isLoading, loadWorkflowFromJson, replaceWorkflow, question};
}

type LoadQuestionOptions = Pick<WorkflowLoadingOptions, 'nodes' | 'setNodes' | 'setEdges'> & {
    pendingWorkflow: PendingWorkflow | null;
    setPendingWorkflow: (workflow: PendingWorkflow | null) => void;
    whileLoading: ReturnType<typeof useLoadingOverlay>[1];
    showWorkflow: (workflow: Workflow, fileName?: string) => void;
    addLayer: ReturnType<typeof useLayers>['addLayer'];
};

function useLoadQuestion (options: LoadQuestionOptions): LoadQuestion {
    const {pendingWorkflow: pending, setPendingWorkflow, whileLoading, showWorkflow, addLayer, nodes, setNodes, setEdges} = options;
    const close = () => setPendingWorkflow(null);

    const merge = () => {
        if (!pending) return;

        // Placed under the nodes as shown when the user chose, then added to the layer as it is by now: a running
        // workflow may have updated its nodes in the meantime.
        whileLoading(() => {
            const placed = placeBelow(nodes, pending);

            setNodes(current => [...current, ...placed.nodes]);
            setEdges(current => [...current, ...placed.edges]);
        }, close);
    };

    const replace = () => {
        if (pending) whileLoading(() => showWorkflow(pending, pending.fileName), close);
    };

    // The loaded workflow gets a layer of its own; this one is left as it is, running or not.
    const loadIntoNewLayer = () => {
        if (!pending) return;

        close();
        addLayer({name: layerNameOf(pending.fileName) || undefined, workflowJson: pending.json});
    };

    return {open: pending !== null, close, merge, replace, loadIntoNewLayer};
}
