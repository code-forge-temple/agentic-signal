/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {NodeDescriptor} from "../types";
import {DataSourceNode as component} from "./DataSourceNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPES, DataSourceNode, DataSourceNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const DataSourceNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataSourceNode> = {
    type: NODE_TYPE,
    component: component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDataSourceNodeData,
    metadata: {
        description: "Provides static data to a workflow. Can supply raw JSON or markdown text with optional attached files.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                outputSchema: z.any().describe("Provided static data or markdown output."),
            },
            [NODE_PORT_IDS.TRIGGER]: true,
        },
        configSchema: DataSourceNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        dataSource: {
            value: {
                text: "",
                files: []
            },
            type: DATA_SOURCE_TYPES.MARKDOWN
        },
        toSanitize: ["input"],
    }
};