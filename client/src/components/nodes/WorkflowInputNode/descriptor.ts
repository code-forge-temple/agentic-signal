/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {WorkflowInputNode as component} from "./WorkflowInputNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsWorkflowInputNodeData, WorkflowInputNode, WorkflowInputNodeDataSchema} from "./types/workflow";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const WorkflowInputNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, WorkflowInputNode> = {
    type: NODE_TYPE,
    order: 2,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsWorkflowInputNodeData,
    metadata: {
        // eslint-disable-next-line max-len
        description: "Starts the workflow when its command is called, and emits the caller's input. A saved workflow can be called from the AI Buddy chat as /<command>; a workflow open in a layer, once its Run button is on, can be called from outside apps. Pair it with a Workflow Output, which hands the result back.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                outputSchema: NodeEnvelopeSchema.describe("The caller's input: in the chat, the text after the command."),
            },
        },
        configSchema: WorkflowInputNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        command: "",
        description: "",
        toSanitize: [],
    }
};
