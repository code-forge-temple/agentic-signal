/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createContext} from "react";
import {AI_ASSISTANT_TITLE} from "../components/Dock/components/AIAssistantDock/constants";


export const LAYER_KIND = {
    AI: "ai",
    USER: "user",
} as const;

export type LayerKind = typeof LAYER_KIND[keyof typeof LAYER_KIND];

export type Layer = {
    id: string;
    name: string;
    kind: LayerKind;
};

/** A user layer's name until something else names it: "Layer 3". */
export const defaultLayerName = (number: number): string => `Layer ${number}`;

/** Whether `name` is still a layer's default one, not a name the user or a loaded file gave it. */
export const isDefaultLayerName = (name: string): boolean => /^Layer \d+$/.test(name);

export const AI_LAYER: Layer = {
    id: "ai-layer",
    name: AI_ASSISTANT_TITLE,
    kind: LAYER_KIND.AI,
};

export const AI_LAYER_READ_ONLY_HINT = `the ${AI_ASSISTANT_TITLE} layer is read-only`;

export type LoadWorkflowOptions = {
    onError?: (error: string) => void;
    /** The file it was read from: a layer still named "Layer N" takes the file's name when the workflow becomes all of it. */
    fileName?: string;
};

/** What the dock and the AI Assistant can do to a layer's workflow, whichever layer is active. */
export type WorkflowLayerApi = {
    save: () => void;
    clear: () => void;
    loadWorkflowFromJson: (json: string, options?: LoadWorkflowOptions) => void;
    /** For the AI Buddy: loads over whatever is there, with no merge-or-replace question. Throws if invalid. */
    replaceWorkflow: (json: string) => void;
    getWorkflowJson: () => string;
    hasNodes: () => boolean;
};

export type LayersContextType = {
    layers: Layer[];
    activeLayer: Layer;
    setActiveLayer: (id: string) => void;
    /** Adds a user layer and shows it: named `name`, else "Layer N"; `workflowJson` loads into it once it's mounted. */
    addLayer: (options?: {name?: string; workflowJson?: string}) => void;
    deleteLayer: (id: string) => void;
    renameLayer: (id: string, name: string) => void;
    registerLayerApi: (id: string, api: WorkflowLayerApi) => () => void;
    getLayerApi: (id: string) => WorkflowLayerApi | undefined;
    /** The workflow a layer was created with (`addLayer`'s `workflowJson`), handed over once. */
    takeInitialWorkflow: (id: string) => string | undefined;
};

export const LayersContext = createContext<LayersContextType | undefined>(undefined);
