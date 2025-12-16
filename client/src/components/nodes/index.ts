/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Edge} from '../../types/workflow';
import {nodeRegistry} from './nodeRegistry.gen';
import type {NodeTypes} from '@xyflow/react';
import {AppNode} from './workflow.gen';


export {nodeFactory} from './nodeFactory.gen';

export const nodeTypes: NodeTypes = Object.fromEntries(
    nodeRegistry.map(nodeDescriptor => [nodeDescriptor.type, nodeDescriptor.component])
);

export const initialNodes: AppNode[] = [];

export const initialEdges: Edge[] = [];