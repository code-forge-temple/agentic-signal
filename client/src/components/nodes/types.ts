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
    component: React.ComponentType<any>;
    icon: React.ReactElement<{className?: string}>;
    title: string;
    assertion: (data: unknown) => void;
    defaultData: N["data"];
    metadata: {
        description: string;
        configSchema?: z.ZodTypeAny;
        ports: NodePorts;
    }
};