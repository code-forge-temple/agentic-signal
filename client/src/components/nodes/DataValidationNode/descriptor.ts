/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {DataValidationNode as component} from "./DataValidationNode";
import {Icon, NODE_TYPE} from "./constants";
import {assertIsDataValidationNodeData, DataValidationNode} from "./types/workflow";


export const DataValidationNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataValidationNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: "Data Validation",
    assertion: assertIsDataValidationNodeData,
    defaultData: {
        title: "Data Validation",
        schema: "",
        toSanitize: ["input"],
    }
};