/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';
import {ATS_PROVIDERS} from "@shared/types.gen";

export {ATS_PROVIDERS};

export const JobSearchSalarySchema = z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().optional(),
    period: z.string().optional(),
    raw: z.string().optional(),
});

export const JobSearchJobSchema = z.object({
    source: z.enum(ATS_PROVIDERS).describe("The ATS the job came from."),
    ats: z.enum(ATS_PROVIDERS),
    id: z.string(),
    title: z.string(),
    company: z.string(),
    companyToken: z.string(),
    department: z.string().optional(),
    url: z.string().describe("The ATS listing page."),
    applyUrl: z.string().describe("Direct link to the employer's application form."),
    location: z.string(),
    isRemote: z.boolean(),
    candidateLocations: z.array(z.string()).describe("Regions parsed from the location text. Empty = unspecified."),
    eligibleFromTarget: z.boolean().nullable().describe("Whether candidateRegion is allowed. null = undetermined."),
    eligibilityConfidence: z.enum(["high", "low"]),
    employmentType: z.string().optional(),
    seniority: z.string().optional(),
    salary: JobSearchSalarySchema.optional(),
    tags: z.array(z.string()),
    postedAt: z.string().optional().describe("ISO 8601."),
    descriptionHtml: z.string().optional(),
    descriptionText: z.string().optional().describe("Plain text, for a downstream LLM node."),
    raw: z.any(),
});

export const JobSearchOutputSchema = z.object({
    jobs: z.array(JobSearchJobSchema),
    counts: z.record(z.number()).describe("companies, reachable, jobsFetched, afterFilter, afterDedupe, returned."),
    errors: z.array(z.object({
        company: z.string(),
        ats: z.string(),
        message: z.string(),
    })).describe("Companies that couldn't be reached — the rest still return."),
});

export type JobSearchOutput = z.infer<typeof JobSearchOutputSchema>;
