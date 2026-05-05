/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {JsonReformatterNode as component} from "./JsonReformatterNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsJsonReformatterNodeData, JsonReformatterNode, JsonReformatterNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const JsonReformatterNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, JsonReformatterNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsJsonReformatterNodeData,
    metadata: {
        description: "Transforms incoming JSON using a JSONata expression. Useful for reshaping, filtering, or extracting data.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: z.any().describe("Incoming JSON object for transformation."),
                outputSchema: z.any().describe("Reformatted JSON output."),
            },
        },
        configSchema: JsonReformatterNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        jsonataExpression: "",
        toSanitize: ["input"],
    }
};