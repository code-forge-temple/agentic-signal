/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useState, useCallback, useMemo, useRef} from "react";
import {v4 as uuidv4} from "uuid";
import {AI_LAYER, defaultLayerName, LAYER_KIND, Layer, LayersContext, WorkflowLayerApi} from "./LayersContextBase";


type LayersState = {
    layers: Layer[];
    activeLayerId: string;
};

// Named `name`, else by the lowest free number, so the layer that replaces a deleted last one is "Layer 1" again.
function createUserLayer (layers: Layer[], id = uuidv4(), name?: string): Layer {
    if (name) return {id, name, kind: LAYER_KIND.USER};

    const names = new Set(layers.map(layer => layer.name));
    let number = 1;

    while (names.has(defaultLayerName(number))) number++;

    return {id, name: defaultLayerName(number), kind: LAYER_KIND.USER};
}

function createInitialState (): LayersState {
    const userLayer = createUserLayer([AI_LAYER]);

    return {layers: [AI_LAYER, userLayer], activeLayerId: userLayer.id};
}

export const LayersProvider = ({children}: { children: React.ReactNode }) => {
    const [{layers, activeLayerId}, setState] = useState<LayersState>(createInitialState);
    const layerApisRef = useRef(new Map<string, WorkflowLayerApi>());
    const initialWorkflowsRef = useRef(new Map<string, string>());

    const setActiveLayer = useCallback((id: string) => {
        setState(prev => prev.layers.some(layer => layer.id === id) ? {...prev, activeLayerId: id} : prev);
    }, []);

    const addLayer = useCallback(({name, workflowJson}: {name?: string; workflowJson?: string} = {}) => {
        // Made outside the updater (StrictMode runs it twice), so the workflow is kept under the id the layer gets.
        const id = uuidv4();

        if (workflowJson !== undefined) initialWorkflowsRef.current.set(id, workflowJson);

        setState(prev => {
            const layer = createUserLayer(prev.layers, id, name);

            return {layers: [...prev.layers, layer], activeLayerId: layer.id};
        });
    }, []);

    const deleteLayer = useCallback((id: string) => {
        setState(prev => {
            const index = prev.layers.findIndex(layer => layer.id === id);

            // Only the user's own layers can go; the AI layer stays for good.
            if (prev.layers[index]?.kind !== LAYER_KIND.USER) return prev;

            let layers = prev.layers.filter(layer => layer.id !== id);

            // A fresh layer rather than the deleted one emptied: nothing of the old workflow
            // (state, timers, pending calls) can outlive it in a new mount.
            if (!layers.some(layer => layer.kind === LAYER_KIND.USER)) {
                layers = [...layers, createUserLayer(layers)];
            }

            // The layer that moved up into its place, else the one above it.
            const activeLayerId = prev.activeLayerId === id
                ? (layers[index] ?? layers[index - 1]).id
                : prev.activeLayerId;

            return {layers, activeLayerId};
        });
    }, []);

    const renameLayer = useCallback((id: string, name: string) => {
        const trimmed = name.trim();

        if (!trimmed) return;

        setState(prev => ({
            ...prev,
            layers: prev.layers.map(layer => layer.id === id && layer.kind === LAYER_KIND.USER ? {...layer, name: trimmed} : layer),
        }));
    }, []);

    const registerLayerApi = useCallback((id: string, api: WorkflowLayerApi) => {
        layerApisRef.current.set(id, api);

        return () => {
            if (layerApisRef.current.get(id) === api) {
                layerApisRef.current.delete(id);
            }
        };
    }, []);

    const getLayerApi = useCallback((id: string) => layerApisRef.current.get(id), []);

    const takeInitialWorkflow = useCallback((id: string) => {
        const json = initialWorkflowsRef.current.get(id);

        initialWorkflowsRef.current.delete(id);

        return json;
    }, []);

    const activeLayer = layers.find(layer => layer.id === activeLayerId) ?? layers[0];

    const value = useMemo(() => ({
        layers,
        activeLayer,
        setActiveLayer,
        addLayer,
        deleteLayer,
        renameLayer,
        registerLayerApi,
        getLayerApi,
        takeInitialWorkflow,
    }), [layers, activeLayer, setActiveLayer, addLayer, deleteLayer, renameLayer, registerLayerApi, getLayerApi, takeInitialWorkflow]);

    return (
        <LayersContext.Provider value={value}>
            {children}
        </LayersContext.Provider>
    );
};
