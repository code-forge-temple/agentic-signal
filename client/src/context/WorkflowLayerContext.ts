/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createContext} from "react";


export type WorkflowLayerContextType = {
    isActive: boolean;
    /** Which layer a node reports to the command router for; null outside any layer. */
    layerId: string | null;
    isAiLayer: boolean;
};

/**
 * The layer a component renders in. Context reaches through portals, so a node's dialogs
 * know it too. Anything outside a layer (the dock's own dialogs) counts as always shown.
 */
export const WorkflowLayerContext = createContext<WorkflowLayerContextType>({isActive: true, layerId: null, isAiLayer: false});
