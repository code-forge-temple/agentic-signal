/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {NormalizedJob} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml} from "../utils.ts";

/**
 * Ashby job board posting API — free, no key.
 * `applyUrl` points straight to the application form; `isRemote` / `employmentType`
 * / `publishedAt` are first-class fields.
 * Optional fields are nullish (job boards send null for empty values) and every object
 * is passthrough, so `raw` keeps the whole posting.
 */
const AshbyJobSchema = z.object({
    id: z.string(),
    title: z.string(),
    department: z.string().nullish(),
    team: z.string().nullish(),
    employmentType: z.string().nullish(),
    location: z.string().nullish(),
    secondaryLocations: z.array(z.object({location: z.string().nullish()}).passthrough()).nullish(),
    publishedAt: z.string().nullish(),
    isListed: z.boolean().nullish(),
    isRemote: z.boolean().nullish(),
    workplaceType: z.string().nullish(),
    jobUrl: z.string(),
    applyUrl: z.string(),
    descriptionHtml: z.string().nullish(),
    descriptionPlain: z.string().nullish(),
    compensation: z.object({compensationTierSummary: z.string().nullish()}).passthrough().nullish(),
}).passthrough();

const AshbyResponseSchema = z.object({jobs: z.array(AshbyJobSchema).nullish()});

const EMPLOYMENT_LABEL: Record<string, string> = {
    FullTime: "Full-time",
    PartTime: "Part-time",
    Intern: "Internship",
    Contract: "Contract",
    Temporary: "Temporary",
};

export async function fetchAshby (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
        `Ashby (${token})`,
        AshbyResponseSchema
    );

    return (data.jobs ?? [])
        .filter(job => job.isListed !== false)
        .map((job): NormalizedJob => {
            const locations = [job.location, ...(job.secondaryLocations ?? []).map(s => s.location)]
                .filter((l): l is string => Boolean(l));
            const location = locations.join(", ");
            const summary = job.compensation?.compensationTierSummary?.trim();

            return {
                source: "ashby",
                ats: "ashby",
                id: job.id,
                title: job.title,
                company: token,
                companyToken: token,
                department: job.department ?? undefined,
                url: job.jobUrl,
                applyUrl: job.applyUrl,
                location: location || "Not specified",
                isRemote: job.isRemote === true || job.workplaceType === "Remote" || /\bremote\b/i.test(location),
                candidateLocations: locations.flatMap(parseRegionList),
                eligibleFromTarget: null,
                eligibilityConfidence: "low",
                employmentType: job.employmentType ? EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType : undefined,
                salary: summary ? {raw: summary} : undefined,
                tags: [job.department, job.team].filter((t): t is string => Boolean(t)),
                postedAt: job.publishedAt || undefined,
                descriptionHtml: job.descriptionHtml || undefined,
                descriptionText: job.descriptionPlain || stripHtml(job.descriptionHtml),
                raw: job,
            };
        });
}
