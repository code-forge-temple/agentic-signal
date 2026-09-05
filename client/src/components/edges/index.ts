/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {EdgeTypes} from '@xyflow/react';
import {ElbowEdge} from './ElbowEdge/ElbowEdge';


export const DEFAULT_EDGE_TYPE = 'elbow';

export const edgeTypes: EdgeTypes = {
    [DEFAULT_EDGE_TYPE]: ElbowEdge,
};
