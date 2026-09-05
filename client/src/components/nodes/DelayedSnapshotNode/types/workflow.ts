/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';


export const DelayedSnapshotNodeDataSchema = z.object({
    persistedPayload: z.unknown().optional()
        .describe("Persisted copy of the last received payload — survives workflow save/reload, replayed on Run."),
    persistedToolsPayload: z.unknown().optional()
        .describe("Persisted copy of the last received toolsPayload — survives workflow save/reload, replayed on Run."),
    delaySeconds: z.number().min(0).optional()
        .describe("Seconds to wait before forwarding new input downstream. 0 or unset forwards immediately."),
    isDelayPending: z.boolean().optional()
        .describe("Internal: true while a delayed forward is scheduled server-side, so a page reload can resume tracking it instead of losing it."),
});

export type DelayedSnapshotNodeData = z.infer<typeof DelayedSnapshotNodeDataSchema>;

export function assertIsDelayedSnapshotNodeData (data: unknown): asserts data is DelayedSnapshotNodeData {
    DelayedSnapshotNodeDataSchema.parse(data);
}

export type DelayedSnapshotNode = Node<BaseNodeData & DelayedSnapshotNodeData> & { type: typeof NODE_TYPE };
