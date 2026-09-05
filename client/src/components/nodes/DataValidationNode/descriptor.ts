/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {DataValidationNode as component} from "./DataValidationNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDataValidationNodeData, DataValidationNode, DataValidationNodeDataSchema} from "./types/workflow";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const DataValidationNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DataValidationNode> = {
    type: NODE_TYPE,
    order: 6,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDataValidationNodeData,
    migrate: (data: any) => {
        let next = data;

        if (next?.schema !== undefined && next?.payloadSchema === undefined) {
            const {schema, ...rest} = next;

            next = {...rest, payloadSchema: schema};
        }

        // Pre-existing workflows already relied on a non-empty toolsPayloadSchema to opt into
        // validation (there was no explicit toggle) — preserve that behavior for them instead
        // of silently switching their toolsPayload validation off.
        if (next?.toolsPayloadSchema?.trim() && next?.validateToolsPayload === undefined) {
            next = {...next, validateToolsPayload: true};
        }

        return next;
    },
    metadata: {
        // eslint-disable-next-line max-len
        description: "Validates incoming payload against a JSON Schema when Validate Payload is on (default), and toolsPayload against a second JSON Schema when Validate Tools Payload is on (default off). An empty schema is permissive (that side passes through unchanged) even when its toggle is on. Either side failing its (non-empty) schema blocks all output.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: NodeEnvelopeSchema,
                outputSchema: NodeEnvelopeSchema,
            },
        },
        configSchema: DataValidationNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        validatePayload: true,
        payloadSchema: "",
        validateToolsPayload: false,
        toolsPayloadSchema: "",
        toSanitize: ["input"],
    }
};