/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

/** Upstream override, used only when the node's "Provided by Upstream" switch is on. */
export const JobSearchNodeInputSchema = z.object({
    companies: z.string().describe("Newline- or comma-separated companies (`ats:token`, an ATS board URL, or a bare name)."),
    keywords: z.string().optional().describe("Comma-separated phrases; a role matches when every word of any phrase is in its title/department."),
    candidateRegion: z.string().optional().describe("Where the applicant is based, e.g. 'Cyprus'."),
});

export type JobSearchNodeInput = z.infer<typeof JobSearchNodeInputSchema>;

export const JOB_SEARCH_NODE_INPUT_JSON_SCHEMA = JSON.stringify(zodToJsonSchema(JobSearchNodeInputSchema), null, 4);
