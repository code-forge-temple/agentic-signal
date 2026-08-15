/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NODE_PORT_IDS} from '../../constants';

export type Position = { x: number; y: number };

export type DataNode = {
    data: any;
}

export type NodePorts = {
    [NODE_PORT_IDS.FLOW]?: {
        inputSchema?: z.ZodTypeAny;
        outputSchema?: z.ZodTypeAny;
    };
    [NODE_PORT_IDS.TRIGGER]?: boolean;
    [NODE_PORT_IDS.CONTEXT]?: boolean;
    [NODE_PORT_IDS.TOOL]?: boolean;
};

export type NodeDescriptor<T extends string, N extends DataNode> = {
    type: T;
    /** Controls display order in the nodes dock (ascending). */
    order: number;
    component: React.ComponentType<any>;
    icon: React.ReactElement<{className?: string}>;
    title: string;
    assertion: (data: unknown) => void;
    /**
     * Rewrites legacy data shapes (e.g. a renamed field/value) into the current shape,
     * applied on workflow load before `assertion` runs. Optional — most nodes have no
     * legacy baggage to carry. Must be a pure function: return new data, don't mutate
     * the input, and it should be a no-op (return unchanged) when data is already current
     * so it's safe to run unconditionally on every load.
     */
    migrate?: (data: any) => any;
    defaultData: N["data"];
    metadata: {
        description: string;
        configSchema?: z.ZodTypeAny;
        ports: NodePorts;
    }
};