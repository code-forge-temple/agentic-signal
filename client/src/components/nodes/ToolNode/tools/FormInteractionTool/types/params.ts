/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable max-len */

import {z} from "zod";
import {FILL_ACTION_TYPES} from "@shared/types.gen";

// LLMs send null for "no value" (e.g. `value: null` on a check action); taking it as omitted saves a rejected
// call and a retry. A preprocess, unlike .nullish(), keeps the JSON schema the LLM sees a plain string.
const optionalLlmString = () => z.preprocess((value) => value === null ? undefined : value, z.string().optional());

// Single source of truth for one raw fill action: feeds both the JSON schema sent to the
// LLM (via zodToJsonSchema in descriptor.tsx) and runtime validation of what it actually returns.
export const RawLlmFillActionSchema = z.object({
    selector: z.string().describe("CSS selector of the target element."),
    actionType: z.enum(FILL_ACTION_TYPES).describe("fill=type text, select=choose dropdown option by label or value, check/uncheck=toggle checkbox, click=click any element, upload=attach one of the files in availableFiles (requires fileKey)."),
    value: optionalLlmString().describe("Text to type (fill), option label/value to choose (select), or ignored for check/uncheck/click."),
    fileKey: optionalLlmString().describe("Name of the file to upload, exactly as listed in availableFiles in this tool's response (e.g. 'my-cv.pdf'). Required when actionType is 'upload'."),
});

export type RawLlmFillAction = z.infer<typeof RawLlmFillActionSchema>;
