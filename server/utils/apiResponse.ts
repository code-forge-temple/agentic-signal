/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";

const MAX_LISTED_ISSUES = 3;

/**
 * Checks an outside API's parsed JSON against a schema of the fields the caller reads.
 * When the API changes shape, this throws one readable error naming the API and the
 * mismatched fields, instead of letting undefined values flow on to the LLM.
 */
export function parseApiResponse<T> (data: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown>, apiName: string): T {
    const parsed = schema.safeParse(data);

    if (parsed.success) return parsed.data;

    const {issues} = parsed.error;
    const listed = issues
        .slice(0, MAX_LISTED_ISSUES)
        .map(issue => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
    const more = issues.length > MAX_LISTED_ISSUES ? ` and ${issues.length - MAX_LISTED_ISSUES} more` : "";

    throw new Error(`Unexpected response from ${apiName} (${listed}${more})`);
}
