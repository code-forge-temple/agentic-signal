/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {BaseNodeData} from "../../../../types/workflow";
import type {Node} from '@xyflow/react';
import type {NODE_TYPE} from "../constants";
import {z} from 'zod';
import {DATE_POSTED_OPTIONS, DatePosted, EMPLOYMENT_TYPES, EmploymentType, SENIORITY_OPTIONS, Seniority} from "@shared/types.gen";

export {DATE_POSTED_OPTIONS, EMPLOYMENT_TYPES, SENIORITY_OPTIONS};

export type {DatePosted, EmploymentType, Seniority};

export const JobSearchNodeDataSchema = z.object({
    companies: z.string()
        // eslint-disable-next-line max-len
        .describe("Companies to pull, one per line: `greenhouse:stripe`, `lever:vercel`, `ashby:linear`, `workable:acme`, the company's ATS-hosted board URL (jobs.ashbyhq.com/…, boards.greenhouse.io/…, jobs.lever.co/…, apply.workable.com/… — NOT the company's own careers page, which can't be parsed), or a bare name (auto-located across the four ATSs)."),
    seedCompanies: z.array(z.string())
        .describe("`ats:token` keys selected from the built-in starter company list (Greenhouse/Lever/Ashby)."),
    keywords: z.string()
        // eslint-disable-next-line max-len
        .describe("Comma-separated phrases matched against the job title/department (case-insensitive). A role matches a phrase when EVERY word of the phrase appears in the title (any order, substring, so 'engineer' also hits 'engineering'). A role matches if ANY phrase matches. Shorter phrases match more broadly. Empty = every role at the listed companies."),
    remoteOnly: z.boolean()
        .describe("Keep only roles the ATS flags as remote."),
    employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES))
        .describe("Employment types to include. Empty = any."),
    datePosted: z.enum(DATE_POSTED_OPTIONS)
        .describe("Only return roles posted within this window."),
    seniority: z.enum(SENIORITY_OPTIONS)
        .describe("Seniority filter (best-effort, from title)."),
    candidateRegion: z.string()
        .describe("Where you would work from, e.g. 'Cyprus', 'Europe'. Tags each job's eligibility from its location text (best-effort — ATS location data is free text)."),
    filterByEligibility: z.boolean()
        // eslint-disable-next-line max-len
        .describe("Drop roles whose location is a concrete place that doesn't match candidateRegion (e.g. 'Engineer - Germany' when you set 'Cyprus'). Roles with vague/unspecified locations are kept."),
    maxCompanies: z.number().int().min(1).max(400)
        .describe("Cap on how many companies to query in one run (fan-out safety)."),
    resultsLimit: z.number().int().min(1).max(500)
        .describe("Cap on returned jobs after filtering."),
    dataProvidedByUpstream: z.boolean()
        .describe("Take `companies` / `keywords` / `candidateRegion` from the upstream node's payload instead of the fields above."),
});

export type JobSearchNodeData = z.infer<typeof JobSearchNodeDataSchema>;

export function assertIsJobSearchNodeData (data: unknown): asserts data is JobSearchNodeData {
    JobSearchNodeDataSchema.parse(data);
}

export type JobSearchNode = Node<BaseNodeData & JobSearchNodeData> & { type: typeof NODE_TYPE };
