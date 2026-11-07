/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {WorkflowOutputNode as component} from "./WorkflowOutputNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsWorkflowOutputNodeData, WorkflowOutputNode, WorkflowOutputNodeDataSchema} from "./types/workflow";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const WorkflowOutputNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, WorkflowOutputNode> = {
    type: NODE_TYPE,
    order: 15,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsWorkflowOutputNodeData,
    metadata: {
        description: "Hands its input back, as the result, to whoever called the command of the workflow's Workflow Input.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: NodeEnvelopeSchema.describe("The result, handed back to the caller."),
            },
        },
        configSchema: WorkflowOutputNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        toSanitize: ["input"],
    }
};
