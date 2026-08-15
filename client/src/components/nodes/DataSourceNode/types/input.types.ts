/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {NodeInputWithToolsPayloadSchema} from '../../LlmProcessNode/types/input.types';


// DataSourceNode's own refinement: when toolsPayload is present, it must be an array of binary
// file attachments — specific to how DataSourceNode uses toolsPayload (chaining file attachments
// between nodes), not a rule for every consumer of the shared NodeInputWithToolsPayloadSchema.
const FileAttachmentSchema = z.object({
    name: z.string(),
    base64: z.string(),
    mimeType: z.string(),
});

export const DataSourceToolsPayloadSchema = NodeInputWithToolsPayloadSchema.extend({
    toolsPayload: z.array(FileAttachmentSchema).describe("Binary file attachments forwarded from an upstream DataSourceNode."),
});

// For docs/UI only — deliberately permissive (payload can be anything, matching the real
// contract); only toolsPayload is ever actually validated at runtime (see DataSourceNode.tsx).
export const DataSourceInputSchema = z.union([
    DataSourceToolsPayloadSchema.describe("An upstream DataSourceNode's output with file attachments."),
    z.any().describe("An upstream DataSourceNode's plain output (raw JSON or markdown text)."),
]).describe(
    "Optional — another DataSourceNode's output, prefixed onto this node's own data. JSON is " +
    "shallow-merged (this node's fields take precedence); markdown text is prepended; " +
    "toolsPayload file attachments are combined."
);

export type DataSourceInput = z.infer<typeof DataSourceInputSchema>;

export const DATASOURCE_INPUT_JSON_SCHEMA = JSON.stringify(zodToJsonSchema(DataSourceInputSchema), null, 4);
