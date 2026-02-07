/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {DataSourceNode as component} from "./DataSourceNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPES, DataSourceNode} from "./types/workflow";

export const DataSourceNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataSourceNode> = {
    type: NODE_TYPE,
    component: component,
    icon: Icon,
    title: "Data Source",
    assertion: assertIsDataSourceNodeData,
    defaultData: {
        title: "Data Source",
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