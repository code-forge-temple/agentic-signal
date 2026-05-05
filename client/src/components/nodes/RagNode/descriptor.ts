/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {RagNode as component} from "./RagNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsRagNodeData, defaultRagNodeData, RagNode, RagNodeDataSchema} from "./types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const RagNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, RagNode> = {
    type: NODE_TYPE,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsRagNodeData,
    metadata: {
        description: "Retrieval-Augmented Generation node. Chunks documents, embeds them into Weaviate, and retrieves the top-K relevant chunks for the query.",
        configSchema: RagNodeDataSchema,
        ports: {
            [NODE_PORT_IDS.CONTEXT]: true,
        },
    },
    defaultData: {
        title: TITLE,
        ...defaultRagNodeData,
        toSanitize: ["handler"],
    }
};
