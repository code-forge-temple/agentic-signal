/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {NodeEnvelope} from "../types/workflow";
import {DATA_SOURCE_TYPES} from "../components/nodes/DataSourceNode/types/workflow";
import {buildDataSourceEnvelope, fileDataFromBytes} from "../components/nodes/DataSourceNode/utils";


// eslint-disable-next-line max-len
const EXPECTED_BODY = `Send {"type": "markdown-and-files", "value": {"text": "…", "files": [{"name": "…", "base64": "…", "mimeType": "…", "isToolsPayload": false}]}} or {"type": "json", "value": <any JSON>}.`;

const CommandFileSchema = z.object({
    name: z.string().min(1),
    base64: z.string(),
    mimeType: z.string().optional(),
    isToolsPayload: z.boolean().optional(),
});

/*
 * What an outside app sends to run a command: a Data Source, shaped as that node keeps one, so Workflow Input
 * puts out what a Data Source with the same content would. Two differences, both for the caller's sake: a
 * JSON value comes as JSON, not as the text the node's editor holds, and a file comes as its bytes only (the
 * text the model reads is made from them, as when a file is attached to Data Source).
 */
export const CommandInputSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal(DATA_SOURCE_TYPES.JSON),
        value: z.unknown().refine(value => value !== undefined, "Required"),
    }),
    z.object({
        type: z.literal(DATA_SOURCE_TYPES.MARKDOWN_AND_FILES),
        value: z.object({
            text: z.string(),
            files: z.array(CommandFileSchema),
        }),
    }),
]);

export type CommandInput = z.infer<typeof CommandInputSchema>;

/** The caller's body as the envelope Workflow Input passes on. Throws an error saying what's wrong with the body. */
export function commandInputEnvelope (body: unknown): NodeEnvelope {
    const parsed = CommandInputSchema.safeParse(body);

    if (!parsed.success) {
        const problems = parsed.error.issues.map(issue => `${issue.path.length > 0 ? issue.path.join(".") : "body"}: ${issue.message}`);

        throw new Error(`The body isn't a Data Source (${problems.join("; ")}). ${EXPECTED_BODY}`);
    }

    const input = parsed.data;

    if (input.type === DATA_SOURCE_TYPES.JSON) {
        // Data Source keeps its JSON as the editor's text; the builder parses it back.
        return buildDataSourceEnvelope({type: DATA_SOURCE_TYPES.JSON, value: JSON.stringify(input.value)});
    }

    const files = input.value.files.map((file) => {
        try {
            return fileDataFromBytes(file);
        } catch {
            throw new Error(`File "${file.name}": its base64 isn't valid.`);
        }
    });

    return buildDataSourceEnvelope({type: DATA_SOURCE_TYPES.MARKDOWN_AND_FILES, value: {text: input.value.text, files}});
}
