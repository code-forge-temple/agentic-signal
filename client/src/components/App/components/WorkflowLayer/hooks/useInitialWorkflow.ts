/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from 'react';
import {useLayers} from '../../../../../hooks/useLayers';
import {useLatestValue} from '../../../../../hooks/useLatestValue';


/**
 * A layer made to hold a loaded workflow (Add to New Layer in the load question) loads it once, when it mounts. The
 * workflow is stored before the layer is made, so there is nothing to wait for after that.
 */
export function useInitialWorkflow (layerId: string, load: (json: string) => void) {
    const {takeInitialWorkflow} = useLayers();
    const loadRef = useLatestValue(load);

    useEffect(() => {
        const json = takeInitialWorkflow(layerId);

        if (json !== undefined) loadRef.current(json);
    }, [layerId, takeInitialWorkflow, loadRef]);
}
