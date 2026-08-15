/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';


// A node feeding LlmProcessNode can wrap its output in this shape to route `payload` to the
// LLM's context as usual while `toolsPayload` bypasses the LLM entirely and gets forwarded
// directly to every connected tool's handler call (see LlmProcessNode.tsx's `buildTools`).
// toolsPayload is intentionally untyped here — each tool is responsible for interpreting
// whatever shape it receives (e.g. FormInteractionTool expects an array of
// {name, base64, mimeType} file attachments; a future tool might expect something else).
export const NodeInputWithToolsPayloadSchema = z.object({
    payload: z.unknown().optional().describe("Content routed to the LLM's context as normal input."),
    // Plain `z.unknown()` accepts a missing key just as readily as a present one (Zod reads a
    // missing key as `undefined`, which `unknown` allows) — the refine rejects that, so a plain
    // object with no toolsPayload at all correctly fails this schema instead of false-matching it.
    toolsPayload: z.unknown()
        .refine((v) => v !== undefined, {message: "toolsPayload is required"})
        .describe("Opaque payload forwarded directly to connected tools, bypassing the LLM's context."),
});

export type NodeInputWithToolsPayload = z.infer<typeof NodeInputWithToolsPayloadSchema>;

export function isNodeInputWithToolsPayload (input: unknown): input is NodeInputWithToolsPayload {
    return NodeInputWithToolsPayloadSchema.safeParse(input).success;
}
