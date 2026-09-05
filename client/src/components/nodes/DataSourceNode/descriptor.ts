/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {DataSourceNode as component} from "./DataSourceNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDataSourceNodeData, DATA_SOURCE_TYPES, DataSourceNode, DataSourceNodeDataSchema} from "./types/workflow";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const DataSourceNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataSourceNode> = {
    type: NODE_TYPE,
    order: 3,
    component: component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDataSourceNodeData,
    migrate: (data: any) => {
        if (data?.dataSource?.type === 'markdown') {
            return {...data, dataSource: {...data.dataSource, type: DATA_SOURCE_TYPES.MARKDOWN_AND_FILES}};
        }

        return data;
    },
    metadata: {
        // eslint-disable-next-line max-len
        description: "Provides static data to a workflow. Can supply raw JSON or markdown text with optional attached files. Can optionally receive another DataSourceNode's output on its flow input to chain multiple sources in series — the incoming data is prefixed onto this node's own data (shallow-merged for JSON, prepended as text for markdown, with file attachments combined).",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: NodeEnvelopeSchema,
                outputSchema: NodeEnvelopeSchema,
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
            type: DATA_SOURCE_TYPES.MARKDOWN_AND_FILES
        },
        toSanitize: ["input"],
    }
};