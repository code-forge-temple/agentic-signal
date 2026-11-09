/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from 'react';
import {useLayers} from '../../../../../hooks/useLayers';
import {useLatestValue} from '../../../../../hooks/useLatestValue';
import {WorkflowLayerApi} from '../../../../../context/LayersContextBase';


/**
 * Registers the layer's API once: the dock and the AI Assistant live outside the layers and reach the active one
 * through it. Each call goes to the latest `api`, so the registration never goes stale.
 */
export function useRegisterLayerApi (layerId: string, api: WorkflowLayerApi) {
    const {registerLayerApi} = useLayers();
    const latestApiRef = useLatestValue(api);

    useEffect(() => registerLayerApi(layerId, {
        save: () => latestApiRef.current.save(),
        clear: () => latestApiRef.current.clear(),
        loadWorkflowFromJson: (json, options) => latestApiRef.current.loadWorkflowFromJson(json, options),
        replaceWorkflow: (json) => latestApiRef.current.replaceWorkflow(json),
        getWorkflowJson: () => latestApiRef.current.getWorkflowJson(),
        hasNodes: () => latestApiRef.current.hasNodes(),
    }), [layerId, registerLayerApi, latestApiRef]);
}
