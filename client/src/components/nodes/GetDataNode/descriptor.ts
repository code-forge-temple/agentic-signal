/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {GetDataNode as component} from "./GetDataNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsGetDataNodeData, GetDataNode, GetDataNodeDataSchema} from "./types/workflow";
import {GetDataNodeInputSchema} from "./types/input.types";
import {NODE_PORT_IDS} from '../../../constants';


export const GetDataNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, GetDataNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsGetDataNodeData,
    metadata: {
        configSchema: GetDataNodeDataSchema,
        description: "Fetches data from a URL via HTTP GET. Supports JSON, text, CSV, XML, blob, and arrayBuffer response formats.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: GetDataNodeInputSchema.describe("Input provided by upstream."),
                outputSchema: z.any().describe("Fetched response data from the configured endpoint."),
            },
            [NODE_PORT_IDS.TRIGGER]: true,
        },
    },
    defaultData: {
        title: TITLE,
        url: "",
        dataType: "json",
        dataProvidedByUpstream: false,
        toSanitize: ["input"],
    }
};