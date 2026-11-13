/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {DelayedSnapshotNode as component} from "./DelayedSnapshotNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsDelayedSnapshotNodeData, DelayedSnapshotNode, DelayedSnapshotNodeDataSchema} from "./types/workflow";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const DelayedSnapshotNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, DelayedSnapshotNode> = {
    type: NODE_TYPE,
    order: 18,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsDelayedSnapshotNodeData,
    metadata: {
        // eslint-disable-next-line max-len
        description: "Captures whatever it receives on input and persists it (payload and toolsPayload) into its own saved data, surviving workflow save/reload. Forwards downstream immediately by default, or after a configured delay (seconds, using server-side scheduling) when a delay is set; a delay still waiting isn't saved with the workflow. Manual Run always replays the last persisted snapshot immediately, bypassing any pending delay.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: NodeEnvelopeSchema.describe("Incoming data to persist and forward."),
                outputSchema: NodeEnvelopeSchema.describe("The persisted payload/toolsPayload, forwarded unchanged."),
            },
        },
        configSchema: DelayedSnapshotNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        delaySeconds: 0,
        isDelayPending: false,
        // isDelayPending too: the delay's timer lives in the server's memory, so a saved workflow has none to wait for.
        toSanitize: ["input", "isDelayPending"],
    }
};
