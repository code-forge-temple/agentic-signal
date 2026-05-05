/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {HttpNode as component} from "./HttpNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsHttpNodeData, HttpNode, HttpNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const HttpNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, HttpNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsHttpNodeData,
    metadata: {
        description: "Fetches a fully rendered HTML page from a URL using a headless browser. Outputs the page HTML.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                outputSchema: z.string().describe("Rendered HTML page content."),
            },
            [NODE_PORT_IDS.TRIGGER]: true,
        },
        configSchema: HttpNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        url: "",
        toSanitize: ["input"],
    }
};