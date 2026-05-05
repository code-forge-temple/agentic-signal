/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {DataFlowSpyNode as component} from "./DataFlowSpyNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDataFlowSpyNodeData, DataFlowSpyNode, DataFlowSpyNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const DataFlowSpyNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataFlowSpyNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDataFlowSpyNodeData,
    metadata: {
        description: "Passthrough debugging node. Logs the data passing through it without modifying it.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: z.any().describe("Incoming data to log and inspect."),
            },
        },
        configSchema: DataFlowSpyNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};