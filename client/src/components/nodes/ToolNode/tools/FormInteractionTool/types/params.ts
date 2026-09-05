/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable max-len */

import {z} from "zod";
import {FILL_ACTION_TYPES} from "@shared/types.gen";

// Single source of truth for one raw fill action: feeds both the JSON schema sent to the
// LLM (via zodToJsonSchema in descriptor.tsx) and runtime validation of what it actually returns.
export const RawLlmFillActionSchema = z.object({
    selector: z.string().describe("CSS selector of the target element."),
    actionType: z.enum(FILL_ACTION_TYPES).describe("fill=type text, select=choose dropdown option by label or value, check/uncheck=toggle checkbox, click=click any element, upload=attach a pre-configured file (requires fileKey)."),
    value: z.string().optional().describe("Text to type (fill), option label/value to choose (select), or ignored for check/uncheck/click."),
    fileKey: z.string().optional().describe("Name of the file to upload. Use the original filename of a binary file attached in DataSourceNode (e.g. 'my-cv.pdf'), or a key from the tool's Configured Files setting for pre-existing server-side files. Required when actionType is 'upload'."),
});

export type RawLlmFillAction = z.infer<typeof RawLlmFillActionSchema>;
