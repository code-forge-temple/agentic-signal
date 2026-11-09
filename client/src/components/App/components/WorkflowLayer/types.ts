/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Edge} from '@xyflow/react';
import {AppNode} from '../../../nodes/workflow.gen';


/** A workflow as a layer holds it: React Flow's nodes and edges. */
export type Workflow = {nodes: AppNode[]; edges: Edge[]};
