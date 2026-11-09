/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactNode, useState} from 'react';
import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Edge} from '@xyflow/react';
import {useWorkflowLoading} from './useWorkflowLoading';
import {LAYER_KIND, LayersContext, LayersContextType} from '../../../../../context/LayersContextBase';
import {AppNode} from '../../../../nodes/workflow.gen';


vi.mock('notistack', () => ({useSnackbar: () => ({enqueueSnackbar: vi.fn()})}));

const layer = {id: 'layer-1', name: 'Mine', kind: LAYER_KIND.USER};

const layers = {
    layers: [layer], activeLayer: layer, setActiveLayer: vi.fn(), addLayer: vi.fn(), deleteLayer: vi.fn(), renameLayer: vi.fn(),
    registerLayerApi: vi.fn(), getLayerApi: vi.fn(), takeInitialWorkflow: vi.fn(),
} satisfies LayersContextType;

const wrapper = ({children}: {children: ReactNode}) => <LayersContext.Provider value={layers}>{children}</LayersContext.Provider>;

const existing = {id: 'a', type: 'data-source', position: {x: 0, y: 0}, data: {value: 'before'}} as unknown as AppNode;

const added = JSON.stringify({nodes: [{id: 'b', type: 'data-source', position: {x: 0, y: 0}, data: {
    dataSource: {type: 'markdown-and-files', value: {text: 'added', files: []}},
}}]});

// The layer's own state, as useWorkflow holds it, with the loading hook on top.
function useLayer () {
    const [nodes, setNodes] = useState<AppNode[]>([existing]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const loading = useWorkflowLoading({layer, readOnly: false, nodes, setNodes, setEdges, fitViewOnLoad: vi.fn()});

    return {nodes, edges, setNodes, loading};
}

const wait = (ms: number) => act(() => {
    vi.advanceTimersByTime(ms);
});

describe('useWorkflowLoading', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('keeps a node update made while Add to Existing waits for the overlay', () => {
        const {result} = renderHook(useLayer, {wrapper});

        act(() => result.current.loading.loadWorkflowFromJson(added));
        wait(100);
        expect(result.current.loading.question.open).toBe(true);

        act(() => result.current.loading.question.merge());
        // A running workflow delivers to the existing node in the meantime.
        act(() => result.current.setNodes(current => current.map(node => ({...node, data: {...node.data, value: 'delivered'}}) as unknown as AppNode)));
        wait(100);

        expect(result.current.nodes).toHaveLength(2);
        expect(result.current.nodes[0].data).toEqual({value: 'delivered'});
        expect(result.current.loading.question.open).toBe(false);
    });
});
