/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {DataValidationNode as component} from "./DataValidationNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDataValidationNodeData, DataValidationNode, DataValidationNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const DataValidationNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataValidationNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDataValidationNodeData,
    metadata: {
        description: "Validates incoming data against a JSON Schema. Passes data downstream on success; emits an error on failure.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: z.any().describe("Incoming data to validate."),
                outputSchema: z.any().describe("Validated data passed through downstream."),
            },
        },
        configSchema: DataValidationNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        schema: "",
        toSanitize: ["input"],
    }
};